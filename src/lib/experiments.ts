// Single-experiment lookup for /experiments/[id]. Synchronous (better-
// sqlite3 is sync) and runs server-side inside an RSC — no API route.
//
// Returns Omit<Experiment, "embedding"> so the 1024-dim BLOB never
// leaks to render code that doesn't need it. The embedding lives in
// the vec_experiments virtual table and is only fetched by search.

import { getDb } from "@/lib/db";
import type {
  Decision,
  Experiment,
  ExperimentCategory,
  FailureMode,
  GuardrailMetric,
  Lifecycle,
  SegmentResult,
} from "@/types";

export type ExperimentDetail = Omit<Experiment, "embedding">;

interface Row {
  id: string;
  title: string;
  hypothesis: string;
  category: ExperimentCategory;
  lifecycle: Lifecycle;
  decision: Decision | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: number;
  segment: string;
  segment_size: number;
  primary_metric: string;
  primary_metric_baseline: number;
  primary_metric_treatment: number | null;
  lift_percent: number | null;
  p_value: number | null;
  sample_size: number | null;
  guardrail_metrics: string;
  segment_breakdown: string;
  what_we_learned: string;
  failure_modes: string;
  team: string;
  pm: string;
  tags: string;
}

const ID_PATTERN = /^exp_\d{3,4}$/;

function safeParseArray<T>(raw: string, id: string, field: string): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.warn(`[experiments] ${id}.${field} JSON malformed:`, err);
    return [];
  }
}

export function getExperimentById(id: string): ExperimentDetail | null {
  if (!ID_PATTERN.test(id)) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, title, hypothesis, category, lifecycle, decision,
              start_date, end_date, duration_days,
              segment, segment_size,
              primary_metric, primary_metric_baseline,
              primary_metric_treatment, lift_percent, p_value, sample_size,
              guardrail_metrics, segment_breakdown,
              what_we_learned, failure_modes,
              team, pm, tags
         FROM experiments
        WHERE id = ?`,
    )
    .get(id) as Row | undefined;

  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    hypothesis: row.hypothesis,
    category: row.category,
    lifecycle: row.lifecycle,
    decision: row.decision,
    start_date: row.start_date,
    end_date: row.end_date,
    duration_days: row.duration_days,
    segment: row.segment,
    segment_size: row.segment_size,
    primary_metric: row.primary_metric,
    primary_metric_baseline: row.primary_metric_baseline,
    primary_metric_treatment: row.primary_metric_treatment,
    lift_percent: row.lift_percent,
    p_value: row.p_value,
    sample_size: row.sample_size,
    guardrail_metrics: safeParseArray<GuardrailMetric>(
      row.guardrail_metrics,
      row.id,
      "guardrail_metrics",
    ),
    segment_breakdown: safeParseArray<SegmentResult>(
      row.segment_breakdown,
      row.id,
      "segment_breakdown",
    ),
    what_we_learned: row.what_we_learned,
    failure_modes: safeParseArray<FailureMode>(
      row.failure_modes,
      row.id,
      "failure_modes",
    ),
    team: row.team,
    pm: row.pm,
    tags: safeParseArray<string>(row.tags, row.id, "tags"),
  };
}
