// Shared chip styling for experiment cards / detail pages / lessons.
// Lifted from ExperimentCard so /experiments/[id] doesn't duplicate
// the palette and Phase 6 (lessons graph) has a single source.

import type { Decision } from "@/types";

export const DECISION_COLOR: Record<Decision, string> = {
  shipped: "text-emerald-400",
  killed: "text-rose-400",
  iterated: "text-amber-400",
  inconclusive: "text-[var(--color-fg-muted)]",
  reverted: "text-rose-400",
};

export const MUTED = "text-[var(--color-fg-muted)]";

export function liftColor(lift: number | null): string {
  if (lift === null) return MUTED;
  return lift >= 0 ? "text-emerald-400" : "text-rose-400";
}

export function formatLift(lift: number | null): string {
  if (lift === null) return "n/a";
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${lift.toFixed(1)}%`;
}
