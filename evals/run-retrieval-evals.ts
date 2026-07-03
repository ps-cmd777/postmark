// Layer 3: retrieval eval. recall@5 over top-5 semanticSearch results.
//
// Reporting split: single-item expected sets are reported as hit@5
// (binary), NOT averaged into the recall@5 mean. Averaging binary
// hit/miss with per-query recall fractions produces a noisy composite
// that hides where the retrieval is actually weak. Multi-item queries
// (n≥2) get a mean recall@5; single-item queries get individual hit@5
// lines.
//
// Retrieval inclusion rule note: expected_in_top_5 may include
// topically relevant experiments in ANY decision state — including
// in-flight/paused ones. This differs from Layer 1's citation rule
// (decided-only). Rationale: a user searching a topic wants all
// relevant work surfaced; a verdict citing precedent needs a decided
// outcome to reference. Same corpus, two different eval semantics.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { semanticSearch } from "@/lib/search";

interface RetrievalCase {
  id: string;
  query: string;
  expected_in_top_5: string[];
  rationale: string;
}

interface CaseResult {
  id: string;
  query: string;
  expected: string[];
  top5: string[];
  hits: string[];
  isSingle: boolean;
  recall: number; // undefined-meaningful for single-item; computed anyway
  hitAt5: boolean;
  error?: string;
}

async function runOne(c: RetrievalCase): Promise<CaseResult> {
  try {
    const hits = await semanticSearch(c.query);
    const top5 = hits.slice(0, 5).map((h) => h.id);
    const found = c.expected_in_top_5.filter((id) => top5.includes(id));
    const isSingle = c.expected_in_top_5.length === 1;
    return {
      id: c.id,
      query: c.query,
      expected: c.expected_in_top_5,
      top5,
      hits: found,
      isSingle,
      recall: found.length / c.expected_in_top_5.length,
      hitAt5: found.length > 0,
    };
  } catch (err) {
    return {
      id: c.id,
      query: c.query,
      expected: c.expected_in_top_5,
      top5: [],
      hits: [],
      isSingle: c.expected_in_top_5.length === 1,
      recall: 0,
      hitAt5: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function parseLimit(): number | null {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return null;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toMarkdown(results: CaseResult[], total: number, limit: number | null): string {
  const multi = results.filter((r) => !r.isSingle);
  const single = results.filter((r) => r.isSingle);
  const meanRecall =
    multi.length === 0
      ? 0
      : multi.reduce((s, r) => s + r.recall, 0) / multi.length;
  const singleHits = single.filter((r) => r.hitAt5).length;

  const lines: string[] = [];
  lines.push(`# Retrieval eval — ${timestamp()}`);
  lines.push("");
  lines.push(`Cases run: ${results.length}/${total}${limit ? ` (--limit ${limit})` : ""}`);
  lines.push("");
  lines.push(`- Mean recall@5 (${multi.length} multi-item queries): **${(meanRecall * 100).toFixed(1)}%**`);
  lines.push(`- hit@5 (${single.length} single-item queries): **${singleHits}/${single.length}**`);
  lines.push("");
  lines.push("## Per-case");
  lines.push("");
  lines.push("| id | query | expected | top-5 | recall@5 / hit@5 |");
  lines.push("|---|---|---|---|---|");
  for (const r of results) {
    const metric = r.isSingle
      ? `hit@5: ${r.hitAt5 ? "✓" : "✗"}`
      : `${r.hits.length}/${r.expected.length} (${(r.recall * 100).toFixed(0)}%)`;
    lines.push(
      `| ${r.id} | ${r.query} | ${r.expected.join(", ")} | ${r.top5.join(", ") || "(error)"} | ${metric} |`,
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const casesPath = join(process.cwd(), "evals/cases/retrieval-cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as RetrievalCase[];
  const limit = parseLimit();
  const run = limit ? cases.slice(0, limit) : cases;

  console.log(`Running ${run.length}/${cases.length} retrieval cases…`);
  console.log("");

  const results: CaseResult[] = [];
  for (const c of run) {
    process.stdout.write(`  ${c.id} … `);
    const r = await runOne(c);
    results.push(r);
    const metric = r.isSingle
      ? `hit@5=${r.hitAt5 ? "✓" : "✗"}`
      : `recall=${r.hits.length}/${r.expected.length}`;
    console.log(`top5=[${r.top5.join(", ")}]  ${metric}`);
    if (r.error) console.log(`             ERROR: ${r.error}`);
  }

  const multi = results.filter((r) => !r.isSingle);
  const single = results.filter((r) => r.isSingle);
  const meanRecall =
    multi.length === 0
      ? 0
      : multi.reduce((s, r) => s + r.recall, 0) / multi.length;
  const singleHits = single.filter((r) => r.hitAt5).length;

  console.log("");
  console.log(
    `Mean recall@5: ${(meanRecall * 100).toFixed(1)}%  (${multi.length} multi-item queries)`,
  );
  console.log(`hit@5:         ${singleHits}/${single.length}  (single-item queries)`);

  const outPath = join(
    process.cwd(),
    `evals/results/retrieval-${timestamp()}.md`,
  );
  writeFileSync(outPath, toMarkdown(results, cases.length, limit));
  console.log(`\nReport: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
