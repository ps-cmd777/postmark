// Zod runtime validation for Experiment objects.
// Mirrors src/types/index.ts with two cross-field invariants:
//   1. decision is non-null iff lifecycle ∈ {concluded, archived}
//   2. measurement fields are all-null for pre-launch lifecycles
//      (draft / in_review / scheduled) and all-set for terminal
//      lifecycles (concluded / archived). live / paused are lenient.

import { z } from "zod";
import type { Experiment } from "@/types";

const Category = z.enum([
  "onboarding",
  "pricing",
  "paywall",
  "retention",
  "growth_loop",
  "notification",
  "search",
  "social",
]);

const Lifecycle = z.enum([
  "draft",
  "in_review",
  "scheduled",
  "live",
  "paused",
  "concluded",
  "archived",
]);

const Decision = z.enum(["shipped", "killed", "inconclusive", "iterated", "reverted"]);

const FailureMode = z.enum([
  "novelty_effect",
  "sample_ratio_mismatch",
  "simpsons_paradox",
  "instrumentation_drift",
  "underpowered",
  "segment_imbalance",
  "seasonality",
  "multiple_testing",
  "survivorship_bias",
]);

const GuardrailStatus = z.enum(["pass", "warn", "fail", "pending"]);

const GuardrailMetricSchema = z.object({
  name: z.string().min(1),
  baseline: z.number(),
  treatment: z.number().nullable(),
  delta_percent: z.number().nullable(),
  status: GuardrailStatus,
});

const SegmentResultSchema = z.object({
  segment: z.string().min(1),
  lift_percent: z.number(),
  p_value: z.number(),
  sample_size: z.number().int().nonnegative(),
});

const TERMINAL_LIFECYCLES = ["concluded", "archived"] as const;
const PRELAUNCH_LIFECYCLES = ["draft", "in_review", "scheduled"] as const;

const BaseExperimentSchema = z.object({
  id: z.string().regex(/^exp_\d{3}$/, "id must match exp_NNN"),
  title: z.string().min(1),
  hypothesis: z.string().min(1),
  category: Category,
  lifecycle: Lifecycle,
  decision: Decision.nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  duration_days: z.number().int().positive(),
  segment: z.string().min(1),
  segment_size: z.number().int().nonnegative(),
  primary_metric: z.string().min(1),
  primary_metric_baseline: z.number(),
  primary_metric_treatment: z.number().nullable(),
  lift_percent: z.number().nullable(),
  p_value: z.number().nullable(),
  sample_size: z.number().int().nonnegative().nullable(),
  guardrail_metrics: z.array(GuardrailMetricSchema),
  segment_breakdown: z.array(SegmentResultSchema),
  what_we_learned: z.string().min(1),
  failure_modes: z.array(FailureMode),
  team: z.string().min(1),
  pm: z.string().min(1),
  embedding: z.array(z.number()),
  tags: z.array(z.string().min(1)),
});

export const ExperimentSchema = BaseExperimentSchema.superRefine((exp, ctx) => {
  const isTerminal = (TERMINAL_LIFECYCLES as readonly string[]).includes(exp.lifecycle);
  const isPrelaunch = (PRELAUNCH_LIFECYCLES as readonly string[]).includes(exp.lifecycle);

  // Invariant 1: decision non-null iff terminal lifecycle.
  if (isTerminal && exp.decision === null) {
    ctx.addIssue({
      code: "custom",
      path: ["decision"],
      message: `experiment ${exp.id} has lifecycle '${exp.lifecycle}' but decision is null — terminal experiments must record a decision`,
    });
  }
  if (!isTerminal && exp.decision !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["decision"],
      message: `experiment ${exp.id} has lifecycle '${exp.lifecycle}' but decision is set to '${exp.decision}' — decisions are only valid for concluded/archived experiments`,
    });
  }

  // Invariant 2: measurement fields match lifecycle.
  const measurements = {
    primary_metric_treatment: exp.primary_metric_treatment,
    lift_percent: exp.lift_percent,
    p_value: exp.p_value,
    sample_size: exp.sample_size,
  };
  const measurementValues = Object.values(measurements);
  const allNull = measurementValues.every((v) => v === null);
  const allSet = measurementValues.every((v) => v !== null);

  if (isTerminal && !allSet) {
    const nullFields = Object.entries(measurements)
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    ctx.addIssue({
      code: "custom",
      path: ["primary_metric_treatment"],
      message: `experiment ${exp.id} (lifecycle '${exp.lifecycle}') is missing measurements: ${nullFields.join(", ")} — terminal experiments must have all measurements`,
    });
  }
  if (isPrelaunch && !allNull) {
    const setFields = Object.entries(measurements)
      .filter(([, v]) => v !== null)
      .map(([k]) => k);
    ctx.addIssue({
      code: "custom",
      path: ["primary_metric_treatment"],
      message: `experiment ${exp.id} (lifecycle '${exp.lifecycle}') has set measurements: ${setFields.join(", ")} — pre-launch experiments must have all measurements null`,
    });
  }
});

export function validateExperiment(raw: unknown): Experiment {
  return ExperimentSchema.parse(raw) as Experiment;
}

export interface ValidationFailure {
  id: string;
  errors: string[];
}

export function validateExperiments(raws: unknown[]): {
  valid: Experiment[];
  invalid: ValidationFailure[];
} {
  const valid: Experiment[] = [];
  const invalid: ValidationFailure[] = [];

  for (const raw of raws) {
    const result = ExperimentSchema.safeParse(raw);
    if (result.success) {
      valid.push(result.data as Experiment);
    } else {
      const id =
        raw && typeof raw === "object" && "id" in raw && typeof raw.id === "string"
          ? raw.id
          : "<unknown id>";
      invalid.push({
        id,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        ),
      });
    }
  }

  return { valid, invalid };
}
