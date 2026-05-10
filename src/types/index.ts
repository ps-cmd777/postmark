// Postmark — shared types. See POSTMARK_PROJECT_BRIEF.md §7.

export type ExperimentCategory =
  | "onboarding"
  | "pricing"
  | "paywall"
  | "retention"
  | "growth_loop"
  | "notification"
  | "search"
  | "social";

export type FailureMode =
  | "novelty_effect"
  | "sample_ratio_mismatch"
  | "simpsons_paradox"
  | "instrumentation_drift"
  | "underpowered"
  | "segment_imbalance"
  | "seasonality"
  | "multiple_testing"
  | "survivorship_bias";

export type Lifecycle =
  | "draft"
  | "in_review"
  | "scheduled"
  | "live"
  | "paused"
  | "concluded"
  | "archived";

// Decision is null until lifecycle is "concluded".
// Validated at the data boundary by Zod in Phase 2.
export type Decision = "shipped" | "killed" | "inconclusive" | "iterated" | "reverted";

export interface GuardrailMetric {
  name: string;
  baseline: number;
  treatment: number;
  delta_percent: number;
  status: "pass" | "warn" | "fail";
}

export interface SegmentResult {
  segment: string;
  lift_percent: number;
  p_value: number;
  sample_size: number;
}

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  category: ExperimentCategory;
  lifecycle: Lifecycle;
  decision: Decision | null;
  start_date: string;
  end_date: string | null;
  duration_days: number;
  segment: string;
  segment_size: number;
  primary_metric: string;
  primary_metric_baseline: number;
  primary_metric_treatment: number;
  lift_percent: number;
  p_value: number;
  sample_size: number;
  guardrail_metrics: GuardrailMetric[];
  segment_breakdown: SegmentResult[];
  what_we_learned: string;
  failure_modes: FailureMode[];
  team: string;
  pm: string;
  embedding: number[];
  tags: string[];
}

export interface Lesson {
  id: string;
  pattern: string;
  description: string;
  related_experiment_ids: string[];
  category: ExperimentCategory[];
  severity: "critical" | "important" | "note";
  detection_query: string;
}

export interface ExperimentMatch {
  experiment_id: string;
  similarity_score: number;
  why_relevant: string;
}

export interface DetectedFailureMode {
  mode: FailureMode;
  reason: string;
  recommendation: string;
}

export interface SampleSizeRec {
  proposed_sample_size: number | null;
  recommended_sample_size: number;
  adequate: boolean;
  rationale: string;
}

export interface PreflightCheck {
  hypothesis: string;
  similar_experiments: ExperimentMatch[];
  detected_failure_modes: DetectedFailureMode[];
  sample_size_recommendation: SampleSizeRec;
  confidence: number;
  suggested_window_days: number;
}
