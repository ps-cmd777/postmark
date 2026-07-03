// Layer 1: deterministic verdict eval.
//
// For each case: run streamPreflight(hypothesis), collect the structured
// Verdict + the streamed prose analysis. Grade risk level (when
// grade_risk_level=true) and grade citations by regex-extracting
// [exp_XXX] tokens from the prose.
//
// Why regex-extract from prose: the Verdict object doesn't carry a
// cited_experiments field — citations only exist inline in the streamed
// analysis. A production hardening would add that field to the schema;
// see evals/README.md.
//
// Citation rule note: verdict cases only allow DECIDED experiments in
// must_cite. Undecided (in-flight) experiments can't serve as
// precedent for a verdict. This differs from Layer 3 retrieval, which
// grades on topical relevance regardless of decision state.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { streamPreflight } from "@/lib/preflight";
import type { Verdict } from "@/lib/preflight";

interface VerdictCase {
  id: string;
  hypothesis: string;
  expected_risk: "low" | "medium" | "high";
  grade_risk_level: boolean;
  must_cite: string[];
  must_not_cite: string[];
  rationale: string;
}

interface CaseResult {
  id: string;
  hypothesis: string;
  expected_risk: "low" | "medium" | "high";
  grade_risk_level: boolean;
  actual_risk: string | null;
  pattern_name: string | null;
  risk_summary: string | null;
  cited_ids: string[];
  must_cite: string[];
  must_not_cite: string[];
  risk_correct: boolean | null; // null when grade_risk_level=false
  missing_cites: string[];
  forbidden_cites_hit: string[];
  citations_pass: boolean;
  analysis: string;
  error?: string;
}

const CITE_RE = /\[(exp_\d{3})\]/g;

function extractCitations(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(CITE_RE)) seen.add(m[1]);
  return [...seen];
}

async function runOne(c: VerdictCase): Promise<CaseResult> {
  let verdict: Verdict | null = null;
  let analysis = "";
  let error: string | undefined;

  try {
    for await (const ev of streamPreflight(c.hypothesis)) {
      if (ev.type === "verdict") verdict = ev.verdict;
      else if (ev.type === "analysis-delta") analysis += ev.delta;
      else if (ev.type === "error") error = ev.message;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const cited = extractCitations(analysis);
  const missing = c.must_cite.filter((id) => !cited.includes(id));
  const forbidden = c.must_not_cite.filter((id) => cited.includes(id));
  const citations_pass = missing.length === 0 && forbidden.length === 0;
  const risk_correct = c.grade_risk_level
    ? verdict?.risk_level === c.expected_risk
    : null;

  return {
    id: c.id,
    hypothesis: c.hypothesis,
    expected_risk: c.expected_risk,
    grade_risk_level: c.grade_risk_level,
    actual_risk: verdict?.risk_level ?? null,
    pattern_name: verdict?.pattern_name ?? null,
    risk_summary: verdict?.risk_summary ?? null,
    cited_ids: cited,
    must_cite: c.must_cite,
    must_not_cite: c.must_not_cite,
    risk_correct,
    missing_cites: missing,
    forbidden_cites_hit: forbidden,
    citations_pass,
    analysis,
    error,
  };
}

function parseLimit(): number | null {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return null;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtRow(r: CaseResult): string {
  const risk = r.grade_risk_level
    ? `${r.expected_risk} → ${r.actual_risk ?? "—"} ${r.risk_correct ? "✓" : "✗"}`
    : `(adv) ${r.actual_risk ?? "—"}`;
  const cites = r.citations_pass ? "✓" : "✗";
  const detail: string[] = [];
  if (r.missing_cites.length) detail.push(`missing ${r.missing_cites.join(",")}`);
  if (r.forbidden_cites_hit.length)
    detail.push(`forbidden ${r.forbidden_cites_hit.join(",")}`);
  return `${r.id.padEnd(9)} | ${risk.padEnd(28)} | cites ${cites}${detail.length ? "  " + detail.join("; ") : ""}`;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toMarkdown(results: CaseResult[], total: number, limit: number | null): string {
  const graded = results.filter((r) => r.grade_risk_level);
  const riskCorrect = graded.filter((r) => r.risk_correct).length;
  const citesCorrect = results.filter((r) => r.citations_pass).length;
  const lines: string[] = [];
  lines.push(`# Verdict eval — ${timestamp()}`);
  lines.push("");
  lines.push(`Cases run: ${results.length}/${total}${limit ? ` (--limit ${limit})` : ""}`);
  lines.push("");
  lines.push(`- Risk level: **${riskCorrect}/${graded.length}** correct (graded cases only)`);
  lines.push(`- Citations: **${citesCorrect}/${results.length}** pass (must_cite present, must_not_cite absent)`);
  lines.push("");
  lines.push("## Per-case");
  lines.push("");
  lines.push("| id | expected | actual | risk | cites | pattern | notes |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    const notes: string[] = [];
    if (r.missing_cites.length) notes.push(`missing ${r.missing_cites.join(", ")}`);
    if (r.forbidden_cites_hit.length)
      notes.push(`forbidden ${r.forbidden_cites_hit.join(", ")}`);
    if (r.error) notes.push(`ERROR: ${r.error}`);
    lines.push(
      `| ${r.id} | ${r.expected_risk} | ${r.actual_risk ?? "—"} | ${r.grade_risk_level ? (r.risk_correct ? "✓" : "✗") : "n/a"} | ${r.citations_pass ? "✓" : "✗"} | ${r.pattern_name ?? "—"} | ${notes.join("; ")} |`,
    );
  }
  lines.push("");
  lines.push("## Full analysis prose (per case)");
  for (const r of results) {
    lines.push("");
    lines.push(`### ${r.id} — ${r.hypothesis}`);
    lines.push("");
    lines.push(`Verdict: **${r.actual_risk ?? "—"}** · pattern: ${r.pattern_name ?? "—"}`);
    lines.push("");
    lines.push(`Cited: ${r.cited_ids.length ? r.cited_ids.join(", ") : "(none)"}`);
    lines.push("");
    lines.push(`Summary: ${r.risk_summary ?? "—"}`);
    lines.push("");
    lines.push("Analysis:");
    lines.push("");
    lines.push("> " + r.analysis.trim().split("\n").join("\n> "));
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const casesPath = join(process.cwd(), "evals/cases/verdict-cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as VerdictCase[];
  const limit = parseLimit();
  const run = limit ? cases.slice(0, limit) : cases;

  console.log(`Running ${run.length}/${cases.length} verdict cases…`);
  console.log("");

  const results: CaseResult[] = [];
  for (const c of run) {
    process.stdout.write(`  ${c.id} … `);
    const r = await runOne(c);
    results.push(r);
    console.log(fmtRow(r));
    if (r.error) console.log(`             ERROR: ${r.error}`);
  }

  const graded = results.filter((r) => r.grade_risk_level);
  const riskCorrect = graded.filter((r) => r.risk_correct).length;
  const citesCorrect = results.filter((r) => r.citations_pass).length;

  console.log("");
  console.log(`Risk level:  ${riskCorrect}/${graded.length} correct (graded cases)`);
  console.log(`Citations:   ${citesCorrect}/${results.length} pass`);

  const outPath = join(
    process.cwd(),
    `evals/results/verdict-${timestamp()}.md`,
  );
  writeFileSync(outPath, toMarkdown(results, cases.length, limit));
  console.log(`\nReport: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
