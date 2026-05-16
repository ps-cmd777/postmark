// Seed loader. Reads the 3 hand-curated batch files, validates,
// cross-ref-checks, embeds via Voyage, and loads into SQLite +
// sqlite-vec. Idempotent: rerunning produces the same final state.
//
// Run with: npm run seed
//
// Requires VOYAGE_API_KEY in .env (loaded by tsx --env-file-if-exists).

import { performance } from "node:perf_hooks";
import { experimentsBatch1 } from "../data/seed/experiments-batch-1";
import { experimentsBatch2A } from "../data/seed/experiments-batch-2a";
import { experimentsBatch2B } from "../data/seed/experiments-batch-2b";
import { validateExperiments } from "../src/lib/validation";
import { validateCrossReferences } from "../src/lib/refs";
import { generateEmbeddings, redactSecrets } from "../src/lib/embeddings";
import { getDb } from "../src/lib/db";
import type { Experiment } from "../src/types";

function validateEnv(): void {
  if (!process.env.VOYAGE_API_KEY) {
    console.error(
      "❌ VOYAGE_API_KEY not set in .env (see .env.example). Add it and rerun `npm run seed`.",
    );
    process.exit(1);
  }
}

function serializeRow(exp: Experiment): Record<string, unknown> {
  return {
    id: exp.id,
    title: exp.title,
    hypothesis: exp.hypothesis,
    category: exp.category,
    lifecycle: exp.lifecycle,
    decision: exp.decision,
    start_date: exp.start_date,
    end_date: exp.end_date,
    duration_days: exp.duration_days,
    segment: exp.segment,
    segment_size: exp.segment_size,
    primary_metric: exp.primary_metric,
    primary_metric_baseline: exp.primary_metric_baseline,
    primary_metric_treatment: exp.primary_metric_treatment,
    lift_percent: exp.lift_percent,
    p_value: exp.p_value,
    sample_size: exp.sample_size,
    guardrail_metrics: JSON.stringify(exp.guardrail_metrics),
    segment_breakdown: JSON.stringify(exp.segment_breakdown),
    what_we_learned: exp.what_we_learned,
    failure_modes: JSON.stringify(exp.failure_modes),
    team: exp.team,
    pm: exp.pm,
    tags: JSON.stringify(exp.tags),
  };
}

function vectorBlob(vec: number[]): Buffer {
  return Buffer.from(new Float32Array(vec).buffer);
}

function countByLifecycle(experiments: Experiment[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of experiments) {
    counts[e.lifecycle] = (counts[e.lifecycle] ?? 0) + 1;
  }
  return counts;
}

async function main(): Promise<void> {
  const tStart = performance.now();

  validateEnv();

  // Stage 1: collect.
  const all = [...experimentsBatch1, ...experimentsBatch2A, ...experimentsBatch2B];
  console.log(`📦 Loaded ${all.length} experiments from 3 batch files.`);

  // Stage 2: Zod validation.
  const { valid, invalid } = validateExperiments(all);
  if (invalid.length > 0) {
    console.error(`❌ ${invalid.length} experiment(s) failed Zod validation:`);
    for (const failure of invalid) {
      console.error(`  ${failure.id}:`);
      for (const err of failure.errors) console.error(`    - ${err}`);
    }
    process.exit(1);
  }
  console.log(`✅ Zod validation passed for all ${valid.length} experiments.`);

  // Stage 3: cross-reference check.
  const refResult = validateCrossReferences(valid);
  if (!refResult.valid) {
    console.error(`❌ ${refResult.brokenRefs.length} broken cross-reference(s):`);
    for (const br of refResult.brokenRefs) {
      console.error(
        `  ${br.sourceExperimentId} → ${br.referencedId} (in ${br.field})\n    "${br.contextSnippet}"`,
      );
    }
    process.exit(1);
  }
  console.log(`✅ Cross-references resolved (scanned hypothesis + what_we_learned).`);

  // Stage 4: embeddings.
  console.log(`🔮 Generating embeddings via Voyage (voyage-3-large, 1024 dims)...`);
  const tEmbedStart = performance.now();
  let embeddings: Map<string, number[]>;
  try {
    embeddings = await generateEmbeddings(valid);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${redactSecrets(raw)}`);
    process.exit(1);
  }
  const tEmbedMs = performance.now() - tEmbedStart;
  console.log(`✅ Generated ${embeddings.size} embeddings.`);

  // Stage 5: DB write (transactional).
  const db = getDb();
  const insertExperiment = db.prepare(`
    INSERT INTO experiments (
      id, title, hypothesis, category, lifecycle, decision,
      start_date, end_date, duration_days, segment, segment_size,
      primary_metric, primary_metric_baseline, primary_metric_treatment,
      lift_percent, p_value, sample_size,
      guardrail_metrics, segment_breakdown, what_we_learned,
      failure_modes, team, pm, tags
    ) VALUES (
      @id, @title, @hypothesis, @category, @lifecycle, @decision,
      @start_date, @end_date, @duration_days, @segment, @segment_size,
      @primary_metric, @primary_metric_baseline, @primary_metric_treatment,
      @lift_percent, @p_value, @sample_size,
      @guardrail_metrics, @segment_breakdown, @what_we_learned,
      @failure_modes, @team, @pm, @tags
    )
  `);
  const insertVec = db.prepare(
    `INSERT INTO vec_experiments (experiment_id, embedding) VALUES (?, ?)`,
  );

  const reseed = db.transaction((rows: Experiment[], embs: Map<string, number[]>) => {
    db.exec("DELETE FROM vec_experiments");
    db.exec("DELETE FROM experiments");
    for (const row of rows) {
      insertExperiment.run(serializeRow(row));
    }
    for (const [id, vec] of embs) {
      insertVec.run(id, vectorBlob(vec));
    }
  });

  const tTxStart = performance.now();
  reseed(valid, embeddings);
  const tTxMs = performance.now() - tTxStart;

  const expCount = (db.prepare("SELECT COUNT(*) AS n FROM experiments").get() as { n: number }).n;
  const vecCount = (db.prepare("SELECT COUNT(*) AS n FROM vec_experiments").get() as { n: number }).n;

  const tTotalMs = performance.now() - tStart;
  const lifecycleCounts = countByLifecycle(valid);

  // Stage 6: report.
  console.log("");
  console.log("─────────────────────────────────────────────────────────");
  console.log("  Seed complete");
  console.log("─────────────────────────────────────────────────────────");
  console.log(`  Validated:           ${valid.length} experiments`);
  console.log(`  Cross-refs:          all resolved`);
  console.log(`  Embeddings:          ${embeddings.size} generated (Voyage voyage-3-large, 1024d)`);
  console.log(`  Experiments table:   ${expCount} rows`);
  console.log(`  vec_experiments:     ${vecCount} rows`);
  console.log("");
  console.log("  Lifecycle distribution:");
  for (const [lifecycle, count] of Object.entries(lifecycleCounts).sort()) {
    console.log(`    ${lifecycle.padEnd(12)} ${count}`);
  }
  console.log("");
  console.log("  Latency:");
  console.log(`    Voyage embed batch:  ${tEmbedMs.toFixed(0)}ms (${valid.length} experiments)`);
  console.log(`    SQL transaction:     ${tTxMs.toFixed(0)}ms (${valid.length} inserts + ${embeddings.size} vec_inserts)`);
  console.log(`    Total seed time:     ${tTotalMs.toFixed(0)}ms`);
  console.log("─────────────────────────────────────────────────────────");
}

main().catch((err) => {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`❌ Seed failed: ${redactSecrets(raw)}`);
  process.exit(1);
});
