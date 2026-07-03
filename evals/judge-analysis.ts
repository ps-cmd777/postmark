// Layer 2: LLM-as-judge for analysis prose.
//
// For each verdict case: run streamPreflight to get the streamed prose
// analysis, look up the actual data for every [exp_XXX] the prose
// cited, and send both to a Haiku call with a strict rubric that scores
// GROUNDING, RELEVANCE, and HONESTY on 1-5. Returns aggregated scores +
// per-case notes; flags any axis score ≤2.
//
// Two-mode insight: deterministic grading (Layer 1) catches wrong risk
// levels and missing citations. It CANNOT catch a fluent analysis that
// invents a number, misreads a decision, or claims a precedent it
// doesn't have. LLM-as-judge scores those free-text failure modes.
//
// Cost note: this makes REAL API calls (one Opus preflight per case +
// one Haiku judge per case). Use --limit N or --cases id1,id2 during
// development.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { streamPreflight } from "@/lib/preflight";
import { getExperimentById, type ExperimentDetail } from "@/lib/experiments";

interface VerdictCase {
  id: string;
  hypothesis: string;
  expected_risk: "low" | "medium" | "high";
  grade_risk_level: boolean;
  must_cite: string[];
  must_not_cite: string[];
  rationale: string;
}

interface JudgeScore {
  grounding: number;
  relevance: number;
  honesty: number;
  notes: string;
}

interface CaseResult {
  id: string;
  hypothesis: string;
  actual_risk: string | null;
  cited_ids: string[];
  analysis: string;
  score: JudgeScore | null;
  flagged: boolean; // any axis ≤ 2
  error?: string;
}

const CITE_RE = /\[(exp_\d{3})\]/g;
const JUDGE_MODEL = "claude-haiku-4-5-20251001";

function extractCitations(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(CITE_RE)) seen.add(m[1]);
  return [...seen];
}

function renderExperiment(exp: ExperimentDetail): string {
  const lift = exp.lift_percent === null ? "n/a" : `${exp.lift_percent}%`;
  const p = exp.p_value === null ? "n/a" : String(exp.p_value);
  const guardrails =
    exp.guardrail_metrics.length === 0
      ? "none"
      : exp.guardrail_metrics
          .map((g) => `${g.name}: ${g.baseline}→${g.treatment} (${g.breach ? "BREACH" : "ok"})`)
          .join("; ");
  return [
    `[${exp.id}] ${exp.title}`,
    `  decision=${exp.decision ?? "n/a"} · lifecycle=${exp.lifecycle}`,
    `  primary_metric=${exp.primary_metric} · lift=${lift} · p=${p} · n=${exp.sample_size ?? "n/a"}`,
    `  segment: ${exp.segment}`,
    `  what_we_learned: ${exp.what_we_learned}`,
    `  guardrails: ${guardrails}`,
  ].join("\n");
}

const JUDGE_SYSTEM =
  "You are grading an AI-generated experiment risk analysis. You will be shown the hypothesis, the analysis prose, and the ground-truth data for every experiment the analysis cited. Score strictly on the rubric. Return ONLY valid JSON with keys grounding, relevance, honesty, notes — no prose outside the JSON.";

function buildJudgePrompt(
  hypothesis: string,
  analysis: string,
  citedExperiments: ExperimentDetail[],
  wasAdversarial: boolean,
): string {
  const sourceBlock =
    citedExperiments.length === 0
      ? "(none — the analysis cited no experiments)"
      : citedExperiments.map(renderExperiment).join("\n\n");

  return `HYPOTHESIS:
${hypothesis}

ANALYSIS PROSE (to be graded):
${analysis}

GROUND-TRUTH SOURCE EXPERIMENTS (data as it exists in the corpus):
${sourceBlock}

RUBRIC — score each axis 1-5:

1. GROUNDING: does every factual claim (numbers, outcomes, decisions) in the analysis trace to a cited experiment's ground-truth data above?
   5 = every specific claim (lift %, p-value, decision, guardrail) is verifiably in the source data.
   3 = mostly grounded, minor drift on 1-2 details (e.g. rounded number, paraphrased outcome).
   1 = fabricated numbers or outcomes not in the source data.

2. RELEVANCE: does the analysis address THIS specific hypothesis?
   5 = every paragraph is on-topic and actionable for the proposing PM.
   3 = mostly on-topic but includes some generic filler.
   1 = analysis is generic or addresses a different question.

3. HONESTY: if precedent is weak, absent, or off-domain, does the analysis SAY so rather than overclaim?
   5 = plainly states weak/absent precedent when true; does not manufacture confidence.
   3 = hedges mildly but still leans on thin evidence.
   1 = confidently overclaims from weak or irrelevant precedent.
   ${wasAdversarial ? "NOTE: this hypothesis is off-domain / has no real corpus support. Honesty is the critical axis — 5 requires explicit acknowledgment that the corpus does not cover this class of decision. Score 1 if the analysis pretends the retrieved experiments are meaningful precedent." : ""}

Return ONLY this JSON:
{"grounding": <1-5>, "relevance": <1-5>, "honesty": <1-5>, "notes": "<2-3 sentences on the most notable strength or failure>"}`;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  _client = new Anthropic({ apiKey });
  return _client;
}

async function judgeOne(
  c: VerdictCase,
  isAdversarial: boolean,
): Promise<CaseResult> {
  let actual_risk: string | null = null;
  let analysis = "";
  let error: string | undefined;

  try {
    for await (const ev of streamPreflight(c.hypothesis)) {
      if (ev.type === "verdict") actual_risk = ev.verdict.risk_level;
      else if (ev.type === "analysis-delta") analysis += ev.delta;
      else if (ev.type === "error") error = ev.message;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const cited = extractCitations(analysis);
  const citedExperiments = cited
    .map((id) => getExperimentById(id))
    .filter((e): e is ExperimentDetail => e !== null);

  if (error || !analysis) {
    return {
      id: c.id,
      hypothesis: c.hypothesis,
      actual_risk,
      cited_ids: cited,
      analysis,
      score: null,
      flagged: true,
      error: error ?? "empty analysis",
    };
  }

  const prompt = buildJudgePrompt(
    c.hypothesis,
    analysis,
    citedExperiments,
    isAdversarial,
  );

  let score: JudgeScore | null = null;
  try {
    const resp = await getClient().messages.create({
      model: JUDGE_MODEL,
      max_tokens: 500,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    // Judge should return only JSON; strip any accidental fencing.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`no JSON in judge response: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(jsonMatch[0]);
    score = {
      grounding: Number(parsed.grounding),
      relevance: Number(parsed.relevance),
      honesty: Number(parsed.honesty),
      notes: String(parsed.notes ?? ""),
    };
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const flagged =
    !!error ||
    !score ||
    score.grounding <= 2 ||
    score.relevance <= 2 ||
    score.honesty <= 2;

  return {
    id: c.id,
    hypothesis: c.hypothesis,
    actual_risk,
    cited_ids: cited,
    analysis,
    score,
    flagged,
    error,
  };
}

function parseArgs(): { limit: number | null; ids: string[] | null } {
  const argv = process.argv;
  const limitIdx = argv.indexOf("--limit");
  const casesIdx = argv.indexOf("--cases");
  const limit =
    limitIdx !== -1 && Number.isFinite(Number(argv[limitIdx + 1]))
      ? Number(argv[limitIdx + 1])
      : null;
  const ids =
    casesIdx !== -1 && argv[casesIdx + 1]
      ? argv[casesIdx + 1].split(",").map((s) => s.trim())
      : null;
  return { limit, ids };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toMarkdown(results: CaseResult[]): string {
  const scored = results.filter((r) => r.score !== null);
  const avg = (k: keyof JudgeScore) =>
    scored.length === 0
      ? 0
      : scored.reduce((s, r) => s + (r.score![k] as number), 0) / scored.length;

  const lines: string[] = [];
  lines.push(`# Judge eval — ${timestamp()}`);
  lines.push("");
  lines.push(`Cases scored: ${scored.length}/${results.length}`);
  lines.push("");
  lines.push(`- Grounding avg: **${avg("grounding").toFixed(2)}**`);
  lines.push(`- Relevance avg: **${avg("relevance").toFixed(2)}**`);
  lines.push(`- Honesty avg:   **${avg("honesty").toFixed(2)}**`);
  lines.push(`- Flagged cases (any axis ≤2 or error): **${results.filter((r) => r.flagged).length}**`);
  lines.push("");
  lines.push("## Per-case");
  lines.push("");
  lines.push("| id | risk | g | r | h | flag | notes |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of results) {
    if (r.score) {
      lines.push(
        `| ${r.id} | ${r.actual_risk ?? "—"} | ${r.score.grounding} | ${r.score.relevance} | ${r.score.honesty} | ${r.flagged ? "⚠" : ""} | ${r.score.notes.replace(/\|/g, "\\|")} |`,
      );
    } else {
      lines.push(`| ${r.id} | ${r.actual_risk ?? "—"} | — | — | — | ⚠ | ERROR: ${r.error} |`);
    }
  }
  lines.push("");
  lines.push("## Analyses (for inspection)");
  for (const r of results) {
    lines.push("");
    lines.push(`### ${r.id}`);
    lines.push("");
    lines.push(`Hypothesis: ${r.hypothesis}`);
    lines.push("");
    lines.push(`Cited: ${r.cited_ids.join(", ") || "(none)"}`);
    lines.push("");
    lines.push("> " + r.analysis.trim().split("\n").join("\n> "));
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const casesPath = join(process.cwd(), "evals/cases/verdict-cases.json");
  const cases = JSON.parse(readFileSync(casesPath, "utf8")) as VerdictCase[];
  const { limit, ids } = parseArgs();

  let run: VerdictCase[];
  if (ids) {
    const byId = new Map(cases.map((c) => [c.id, c]));
    run = ids.map((id) => {
      const c = byId.get(id);
      if (!c) throw new Error(`unknown case id: ${id}`);
      return c;
    });
  } else if (limit) {
    run = cases.slice(0, limit);
  } else {
    run = cases;
  }

  const adversarialIds = new Set(
    cases.filter((c) => !c.grade_risk_level).map((c) => c.id),
  );

  console.log(`Judging ${run.length} case(s) — makes ${run.length} Opus + ${run.length} Haiku calls.`);
  console.log("");

  const results: CaseResult[] = [];
  for (const c of run) {
    process.stdout.write(`  ${c.id} … `);
    const r = await judgeOne(c, adversarialIds.has(c.id));
    results.push(r);
    if (r.score) {
      console.log(
        `g=${r.score.grounding} r=${r.score.relevance} h=${r.score.honesty}${r.flagged ? "  ⚠" : ""}`,
      );
      console.log(`             ${r.score.notes}`);
    } else {
      console.log(`ERROR: ${r.error}`);
    }
  }

  const scored = results.filter((r) => r.score !== null);
  const avg = (k: keyof JudgeScore) =>
    scored.length === 0
      ? 0
      : scored.reduce((s, r) => s + (r.score![k] as number), 0) / scored.length;

  console.log("");
  console.log(`Grounding avg: ${avg("grounding").toFixed(2)}`);
  console.log(`Relevance avg: ${avg("relevance").toFixed(2)}`);
  console.log(`Honesty avg:   ${avg("honesty").toFixed(2)}`);
  console.log(`Flagged:       ${results.filter((r) => r.flagged).length}/${results.length}`);

  const outPath = join(process.cwd(), `evals/results/judge-${timestamp()}.md`);
  writeFileSync(outPath, toMarkdown(results));
  console.log(`\nReport: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
