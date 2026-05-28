// Single pattern card for /lessons. Server component (pure render).
// Card outer carries id={anchorId} + scroll-mt-20 so /lessons#pattern_07
// anchor scrolls land with breathing room from the viewport top.
//
// exp_NNN references inside description / institutional_response /
// open_question / refined_lesson are auto-linked by ExperimentLink.
// Member chips use ExperimentLink so styling stays consistent with
// citations elsewhere. Counter-example chips use a dashed-border
// variant (local to this file) to distinguish them visually.

import Link from "next/link";
import ExperimentLink from "./ExperimentLink";
import type { Pattern, PatternStrength } from "@/lib/patterns";

const STRENGTH_LABEL: Record<PatternStrength, string> = {
  hardened: "Hardened",
  emerging: "Emerging",
  single_instance: "Single instance",
};

const STRENGTH_DOT: Record<PatternStrength, string> = {
  hardened: "bg-emerald-400",
  emerging: "bg-amber-400",
  single_instance: "bg-[var(--color-fg-muted)]",
};

const STRENGTH_TEXT: Record<PatternStrength, string> = {
  hardened: "text-emerald-400",
  emerging: "text-amber-400",
  single_instance: "text-[var(--color-fg-muted)]",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--color-fg-muted)]">
      {children}
    </p>
  );
}

function CounterChip({ id }: { id: string }) {
  return (
    <Link
      href={`/experiments/${id}`}
      className="rounded border border-dashed border-amber-700 bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[0.75rem] text-amber-300 transition-colors hover:border-amber-400 hover:underline"
    >
      {id}
    </Link>
  );
}

export default function PatternCard({
  pattern,
  anchorId,
}: {
  pattern: Pattern;
  anchorId: string;
}) {
  return (
    <article
      id={anchorId}
      className="flex scroll-mt-20 flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-[var(--color-fg-muted)]">
            {pattern.id}
          </p>
          <h2 className="mt-1 text-xl font-bold leading-tight tracking-tight text-[var(--color-fg)]">
            {pattern.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${STRENGTH_DOT[pattern.strength]}`}
          />
          <span
            className={`font-mono text-[0.65rem] uppercase tracking-widest ${STRENGTH_TEXT[pattern.strength]}`}
          >
            {STRENGTH_LABEL[pattern.strength]}
          </span>
        </div>
      </header>

      <p className="text-sm leading-7 text-[var(--color-fg)]">
        <ExperimentLink text={pattern.description} />
      </p>

      <div className="flex flex-col gap-2">
        <SectionLabel>Examples</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {pattern.member_experiment_ids.map((id) => (
            <ExperimentLink key={id} text={id} />
          ))}
        </div>
      </div>

      {pattern.counter_instance_ids && pattern.counter_instance_ids.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Counter-examples</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {pattern.counter_instance_ids.map((id) => (
              <CounterChip key={id} id={id} />
            ))}
          </div>
        </div>
      )}

      {pattern.institutional_response && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Institutional response</SectionLabel>
          <p className="text-sm leading-7 text-[var(--color-fg)]">
            <ExperimentLink text={pattern.institutional_response} />
          </p>
        </div>
      )}

      {pattern.open_question && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Open question</SectionLabel>
          <p className="text-sm italic leading-7 text-[var(--color-fg)]">
            <ExperimentLink text={pattern.open_question} />
          </p>
        </div>
      )}

      {pattern.refined_lesson && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Refined lesson</SectionLabel>
          <p className="text-sm leading-7 text-[var(--color-fg)]">
            <ExperimentLink text={pattern.refined_lesson} />
          </p>
        </div>
      )}
    </article>
  );
}
