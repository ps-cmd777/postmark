// Compact result card. Whole card is a Link to /experiments/[id]
// (Phase 5 — detail route is live). Hover state matches the
// secondary-tile convention on the homepage: border lights up to
// the accent color.

import Link from "next/link";
import type { SearchHit } from "@/lib/search";
import { DECISION_COLOR, MUTED, formatLift, liftColor } from "@/lib/chips";

export default function ExperimentCard({ hit }: { hit: SearchHit }) {
  const decisionClass =
    hit.decision !== null ? (DECISION_COLOR[hit.decision] ?? MUTED) : MUTED;

  return (
    <Link
      href={`/experiments/${hit.id}`}
      className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 transition-colors hover:border-[var(--color-accent)]"
    >
      <article>
        <header className="flex items-baseline justify-between gap-4">
          <h3 className="text-base font-medium leading-snug text-[var(--color-fg)]">
            {hit.title}
          </h3>
          <span className="font-mono text-xs text-[var(--color-fg-muted)]">
            {hit.id}
          </span>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-xs">
          <span className={liftColor(hit.lift_percent)}>
            {formatLift(hit.lift_percent)}
          </span>
          <span className="text-[var(--color-fg-muted)]">
            {hit.primary_metric}
          </span>
          <span className={decisionClass}>{hit.decision ?? hit.lifecycle}</span>
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
    </Link>
  );
}
