// Phase 4 — pre-flight check orchestrator. Reuses Phase 3's retrieval
// substrate (semanticSearch in src/lib/search.ts) and runs two
// sequential Opus 4.7 calls:
//   1. Forced tool_use call to submit_verdict — emits the structured
//      verdict deterministically. Non-streaming; we need the full
//      tool input before continuing.
//   2. Streamed continuation, with the verdict turn replayed as
//      assistant context and a follow-up user message asking for
//      prose analysis. No tools on this call so Opus can't
//      re-invoke submit_verdict.
//
// Why two calls: Opus 4.7 treats a forced tool_use turn as complete
// and won't keep writing prose after it. Splitting also lets the
// verdict ship to the client in one round-trip while prose streams.
// The shared system prompt is cache-controlled so call 2 reuses the
// prefix.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { semanticSearch, type SearchHit } from "@/lib/search";
import { redactSecrets } from "@/lib/redact";

export const PREFLIGHT_TOP_K = 8;

const MODEL = "claude-opus-4-7";
const VERDICT_MAX_TOKENS = 400;
const ANALYSIS_MAX_TOKENS = 600;
const LEARNED_TRUNCATE = 400;

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set — see .env.example");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------- Verdict schema (Zod, defense in depth) ----------

export const VerdictSchema = z.object({
  risk_level: z.enum(["low", "medium", "high"]),
  risk_summary: z.string().min(10).max(200),
  pattern_name: z.string().max(120).nullable(),
});
export type Verdict = z.infer<typeof VerdictSchema>;

// ---------- Tool-use input schema (sent to Claude) ----------

const VERDICT_TOOL = {
  name: "submit_verdict",
  description:
    "Submit the structured pre-flight verdict before writing the prose analysis. Call this exactly once, at the start of your response.",
  input_schema: {
    type: "object" as const,
    properties: {
      risk_level: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "See system prompt for thresholds.",
      },
      risk_summary: {
        type: "string",
        minLength: 10,
        maxLength: 150,
        description:
          "One sentence in plain language. Aim for ~80-120 chars. No emojis.",
      },
      pattern_name: {
        type: ["string", "null"],
        maxLength: 80,
        description:
          "Named meta-pattern detected in the corpus (e.g. 'forced action in onboarding'). null when no named pattern applies.",
      },
    },
    required: ["risk_level", "risk_summary", "pattern_name"],
    additionalProperties: false,
  },
};

// ---------- Prompt construction ----------

const SYSTEM_PROMPT = `You are a senior product manager doing a pre-flight review on a proposed experiment at Pixmate, a consumer photo/video app. You are reviewing the hypothesis below against ${PREFLIGHT_TOP_K} past Pixmate experiments retrieved as structurally similar to it. Your job is to warn the proposing PM about risks the corpus already knows about — wins to build on, failures at risk of repeating, named patterns that apply.

risk_level criteria (apply strictly):
  - high: a named anti-pattern from the corpus matches the proposed hypothesis (e.g. forced action in onboarding, on-device vision on low-RAM Android, displaced-message-slot risk, blocking surface in new-user flow), OR ≥2 prior experiments structurally adjacent to this hypothesis ended with strongly negative outcomes (decision killed/reverted with materially negative lift).
  - medium: mixed precedent — some supporting wins but with unresolved caveats (segment imbalance, platform-specific failure, untested follow-up question, guardrail concern, etc.).
  - low: strong supporting precedent in the corpus, OR no clear structural matches at all. If matches are weak, say so honestly in the risk_summary rather than inventing concern.

pattern_name: when a corpus-attested meta-pattern applies, name it exactly as the corpus does (read the retrieved learnings for the naming). Null when no named pattern fits.

Analysis constraints (apply when writing the prose follow-up):
  - Cap analysis at 5-7 sentences.
  - Plain prose only. No bullet lists. No numbered lists. No markdown headers. No emojis.
  - Numbers when they matter (specific lifts, p-values, retention deltas).
  - Cite specific experiment IDs inline in square brackets like [exp_007]. Cite only from the retrieved set — do not invent IDs.
  - Don't say "the corpus" or "the experiments" abstractly. Say what specifically: "[exp_010] and [exp_027] both...".
  - Be direct. The proposing PM is reading this to decide whether to ship the experiment — vague hedging wastes their time.`;

const ANALYSIS_FOLLOWUP =
  "Now write the 5-7 sentence analysis. Plain prose only. Cite specific experiment IDs inline like [exp_007]. Do not call any tools.";

function renderHit(hit: SearchHit): string {
  const fmtNum = (n: number | null) => (n === null ? "n/a" : String(n));
  const liftStr =
    hit.lift_percent === null
      ? "n/a"
      : `${hit.lift_percent >= 0 ? "+" : ""}${hit.lift_percent}%`;
  const learned =
    hit.what_we_learned.length > LEARNED_TRUNCATE
      ? `${hit.what_we_learned.slice(0, LEARNED_TRUNCATE).trimEnd()}…`
      : hit.what_we_learned;
  const tags = hit.tags.slice(0, 8).join(", ");
  return [
    `[${hit.id}] ${hit.title}`,
    `  category=${hit.category} · lifecycle=${hit.lifecycle} · decision=${hit.decision ?? "n/a"}`,
    `  primary=${hit.primary_metric} · lift=${liftStr} · p=${fmtNum(hit.p_value)}`,
    `  segment: ${hit.segment}`,
    `  tags: ${tags}`,
    `  learned: ${learned}`,
  ].join("\n");
}

function buildUserMessage(hypothesis: string, hits: SearchHit[]): string {
  const blocks = hits.map(renderHit).join("\n\n");
  return `PROPOSED HYPOTHESIS:\n${hypothesis}\n\nRETRIEVED PRECEDENTS (K=${hits.length}, ordered by similarity):\n${blocks}`;
}

// ---------- Streaming event types ----------

export type PreflightEvent =
  | { type: "precedents"; hits: SearchHit[] }
  | { type: "verdict"; verdict: Verdict }
  | { type: "analysis-delta"; delta: string }
  | { type: "error"; message: string };

// ---------- Zero-hit synthetic verdict ----------

function syntheticEmptyCorpus(): {
  verdict: Verdict;
  analysis: string;
} {
  return {
    verdict: {
      risk_level: "low",
      risk_summary:
        "No structural matches in the archive — proceed but capture results carefully.",
      pattern_name: null,
    },
    analysis:
      "The corpus contains no experiments structurally adjacent to this hypothesis. Treat this as a green-field test and document the design choices carefully so future pre-flights have something to retrieve against.",
  };
}

// ---------- Shared verdict path (used by streamPreflight + MCP) ----------

// Discriminated result. `continuation` carries the Anthropic call-1
// response + tool_use_id so the streaming caller can replay them as
// assistant + tool_result context in call 2. `continuation: null`
// signals the zero-hit synthetic path — callers handle the synthetic
// analysis themselves (web stream emits a fixed delta, MCP omits
// analysis entirely since the tool only returns verdict + precedents).
export type PreflightVerdictResult =
  | {
      ok: true;
      hits: SearchHit[];
      verdict: Verdict;
      continuation: {
        verdictResponse: Anthropic.Messages.Message;
        toolUseId: string;
        userMessage: string;
        systemBlocks: Array<{
          type: "text";
          text: string;
          cache_control: { type: "ephemeral" };
        }>;
      } | null;
    }
  | { ok: false; error: string };

export async function runPreflightVerdict(
  hypothesis: string,
): Promise<PreflightVerdictResult> {
  // 1. Retrieval — reuse Phase 3 pipeline; slice 10 → PREFLIGHT_TOP_K.
  let hits: SearchHit[];
  try {
    const allHits = await semanticSearch(hypothesis);
    hits = allHits.slice(0, PREFLIGHT_TOP_K);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { ok: false, error: redactSecrets(raw) };
  }

  // 2. Zero-hit short circuit — synthetic verdict, no Opus call.
  if (hits.length === 0) {
    const { verdict } = syntheticEmptyCorpus();
    return { ok: true, hits, verdict, continuation: null };
  }

  // 3. Forced-tool Opus call 1.
  const client = getClient();
  const userMessage = buildUserMessage(hypothesis, hits);
  const systemBlocks = [
    {
      type: "text" as const,
      text: SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  let verdictResponse: Anthropic.Messages.Message;
  try {
    verdictResponse = await client.messages.create({
      model: MODEL,
      max_tokens: VERDICT_MAX_TOKENS,
      system: systemBlocks,
      tools: [VERDICT_TOOL],
      tool_choice: { type: "tool", name: VERDICT_TOOL.name },
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: redactSecrets(`Pre-flight verdict call failed: ${raw}`),
    };
  }

  const toolBlock = verdictResponse.content.find(
    (b): b is Extract<typeof b, { type: "tool_use" }> =>
      b.type === "tool_use" && b.name === VERDICT_TOOL.name,
  );
  if (!toolBlock) {
    return {
      ok: false,
      error:
        "Pre-flight verdict was malformed (no tool call from model); try resubmitting.",
    };
  }
  const verdictParse = VerdictSchema.safeParse(toolBlock.input);
  if (!verdictParse.success) {
    return {
      ok: false,
      error: "Pre-flight verdict was malformed; try resubmitting.",
    };
  }

  return {
    ok: true,
    hits,
    verdict: verdictParse.data,
    continuation: {
      verdictResponse,
      toolUseId: toolBlock.id,
      userMessage,
      systemBlocks,
    },
  };
}

// ---------- Streaming entry point (SSE) ----------

export async function* streamPreflight(
  hypothesis: string,
): AsyncGenerator<PreflightEvent, void, unknown> {
  const result = await runPreflightVerdict(hypothesis);

  if (!result.ok) {
    yield { type: "error", message: result.error };
    return;
  }

  yield { type: "precedents", hits: result.hits };
  yield { type: "verdict", verdict: result.verdict };

  // Zero-hit synthetic path: emit the canned analysis as one delta.
  if (result.continuation === null) {
    const { analysis } = syntheticEmptyCorpus();
    yield { type: "analysis-delta", delta: analysis };
    return;
  }

  // Call 2: streamed prose continuation. No tools — Opus can't
  // re-invoke submit_verdict. Replay verdictResponse.content as
  // assistant turn so the model has its own verdict in context.
  const client = getClient();
  const { verdictResponse, toolUseId, userMessage, systemBlocks } =
    result.continuation;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: ANALYSIS_MAX_TOKENS,
      system: systemBlocks,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: verdictResponse.content },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: toolUseId,
              content: "Verdict recorded.",
            },
            { type: "text", text: ANALYSIS_FOLLOWUP },
          ],
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "analysis-delta", delta: event.delta.text };
      }
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    yield {
      type: "error",
      message: redactSecrets(`Pre-flight analysis stream failed: ${raw}`),
    };
  }
}
