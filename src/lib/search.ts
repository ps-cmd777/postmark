// Semantic search over the experiment corpus. Embeds the user's query
// with Voyage (input_type="query" — asymmetric retrieval; documents
// were embedded with input_type="document" at seed time), then runs a
// k-NN cosine query against the sqlite-vec virtual table.
//
// Returns a lean hit shape (no full Experiment, no embedding vector)
// so the SSE payload stays small.

// The voyageai SDK ships an ESM build that Next/Turbopack can't resolve
// (extended/index.mjs imports a missing "../Client"). Seed-time runs
// through tsx and tolerates it; the request path here calls the REST
// API directly. One less surface to argue with at build time, and
// keeps the dependency tree honest.
import { getDb } from "@/lib/db";
import { redactSecrets } from "@/lib/redact";
import type { Decision, ExperimentCategory, Lifecycle } from "@/types";

const EMBED_MODEL = "voyage-3-large";
const EMBED_DIMENSIONS = 1024;
const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const TOP_K = 10;

export interface SearchHit {
  id: string;
  title: string;
  hypothesis: string;
  category: ExperimentCategory;
  lifecycle: Lifecycle;
  decision: Decision | null;
  lift_percent: number | null;
  p_value: number | null;
  primary_metric: string;
  segment: string;
  team: string;
  pm: string;
  tags: string[];
  what_we_learned: string;
  similarity: number; // 1 - cosine_distance; higher = closer
}

export interface SearchFilters {
  category?: ExperimentCategory;
  decision?: Decision;
}

interface VoyageEmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

async function embedQuery(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY not set — see .env.example");
  }

  let res: Response;
  try {
    res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [query],
        model: EMBED_MODEL,
        input_type: "query",
        output_dimension: EMBED_DIMENSIONS,
      }),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Voyage query embedding failed: ${redactSecrets(raw)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Voyage query embedding failed: HTTP ${res.status} ${redactSecrets(body).slice(0, 200)}`,
    );
  }

  const json = (await res.json()) as VoyageEmbeddingResponse;
  const vec = json.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `Voyage returned unexpected query embedding shape: ${vec?.length ?? "missing"} dims`,
    );
  }
  return vec;
}

interface VecRow {
  experiment_id: string;
  distance: number;
}

interface ExpRow {
  id: string;
  title: string;
  hypothesis: string;
  category: ExperimentCategory;
  lifecycle: Lifecycle;
  decision: Decision | null;
  lift_percent: number | null;
  p_value: number | null;
  primary_metric: string;
  segment: string;
  team: string;
  pm: string;
  tags: string;
  what_we_learned: string;
}

export async function semanticSearch(
  query: string,
  filters: SearchFilters = {},
): Promise<SearchHit[]> {
  const vec = await embedQuery(query);
  const db = getDb();

  // sqlite-vec expects the query vector as a Float32 blob.
  const blob = Buffer.from(new Float32Array(vec).buffer);

  // Over-fetch a bit so post-filtering still leaves a reasonable set.
  const k = filters.category || filters.decision ? TOP_K * 3 : TOP_K;

  const vecRows = db
    .prepare(
      `SELECT experiment_id, distance
         FROM vec_experiments
        WHERE embedding MATCH ?
          AND k = ?
        ORDER BY distance`,
    )
    .all(blob, k) as VecRow[];

  if (vecRows.length === 0) return [];

  const ids = vecRows.map((r) => r.experiment_id);
  const placeholders = ids.map(() => "?").join(",");
  const expRows = db
    .prepare(
      `SELECT id, title, hypothesis, category, lifecycle, decision,
              lift_percent, p_value, primary_metric, segment, team, pm,
              tags, what_we_learned
         FROM experiments
        WHERE id IN (${placeholders})`,
    )
    .all(...ids) as ExpRow[];

  const expById = new Map(expRows.map((r) => [r.id, r]));

  const hits: SearchHit[] = [];
  for (const v of vecRows) {
    const exp = expById.get(v.experiment_id);
    if (!exp) continue;
    if (filters.category && exp.category !== filters.category) continue;
    if (filters.decision && exp.decision !== filters.decision) continue;

    hits.push({
      id: exp.id,
      title: exp.title,
      hypothesis: exp.hypothesis,
      category: exp.category,
      lifecycle: exp.lifecycle,
      decision: exp.decision,
      lift_percent: exp.lift_percent,
      p_value: exp.p_value,
      primary_metric: exp.primary_metric,
      segment: exp.segment,
      team: exp.team,
      pm: exp.pm,
      tags: JSON.parse(exp.tags) as string[],
      what_we_learned: exp.what_we_learned,
      similarity: 1 - v.distance,
    });

    if (hits.length >= TOP_K) break;
  }

  return hits;
}
