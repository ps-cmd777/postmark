// Compact result card for a search hit. Renders title, monospace id,
// signed lift, decision, primary metric, segment, and the one-line
// learning. Click target deferred until Phase 5 (experiment detail
// route does not exist yet).

import type { SearchHit } from "@/lib/search";

function formatLift(lift: number | null): string {
  if (lift === null) return "n/a";
  const sign = lift >= 0 ? "+" : "";
  return `${sign}${lift.toFixed(1)}%`;
}

const DECISION_COLOR: Record<string, string> = {
  shipped: "text-emerald-400",
  killed: "text-rose-400",
  iterated: "text-amber-400",
  inconclusive: "text-[var(--color-fg-muted)]",
  reverted: "text-rose-400",
};

export default function ExperimentCard({ hit }: { hit: SearchHit }) {
  const liftColor =
    hit.lift_percent === null
      ? "text-[var(--color-fg-muted)]"
      : hit.lift_percent >= 0
        ? "text-emerald-400"
        : "text-rose-400";
  const decisionColor =
    hit.decision !== null
      ? (DECISION_COLOR[hit.decision] ?? "text-[var(--color-fg-muted)]")
      : "text-[var(--color-fg-muted)]";

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5">
      <header className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-medium leading-snug text-[var(--color-fg)]">
          {hit.title}
        </h3>
        <span className="font-mono text-xs text-[var(--color-fg-muted)]">{hit.id}</span>
      </header>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs">
        <span className={liftColor}>{formatLift(hit.lift_percent)}</span>
        <span className="text-[var(--color-fg-muted)]">{hit.primary_metric}</span>
        <span className={decisionColor}>{hit.decision ?? hit.lifecycle}</span>
        <span className="text-[var(--color-fg-muted)]">
          sim={hit.similarity.toFixed(2)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-[var(--color-fg)]">
        {hit.what_we_learned}
      </p>

      <footer className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-fg-muted)]">
        <span>{hit.segment}</span>
        <span>·</span>
        <span>{hit.team}</span>
        <span>·</span>
        <span>{hit.pm}</span>
      </footer>
    </article>
  );
}
