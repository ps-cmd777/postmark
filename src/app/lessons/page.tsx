// /lessons — card grid over the 12 hand-curated patterns from
// src/lib/patterns.ts. Sorted hardened → emerging → single_instance,
// then by id within each strength bucket. Server component.

import PatternCard from "@/components/PatternCard";
import { PATTERNS, type PatternStrength } from "@/lib/patterns";

const STRENGTH_RANK: Record<PatternStrength, number> = {
  hardened: 0,
  emerging: 1,
  single_instance: 2,
};

const sorted = [...PATTERNS].sort((a, b) => {
  const r = STRENGTH_RANK[a.strength] - STRENGTH_RANK[b.strength];
  if (r !== 0) return r;
  return a.id.localeCompare(b.id);
});

export default function LessonsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
          postmark · lessons
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Cross-experiment patterns
        </h1>
        <p className="mt-3 text-base text-[var(--color-fg-muted)]">
          What 50 experiments at Pixmate have collectively taught.
        </p>

        <div className="mt-6 flex flex-col gap-4 text-sm leading-7 text-[var(--color-fg)]">
          <p>
            A single experiment teaches a narrow lesson — this nudge worked,
            this gate failed. Cross-experiment patterns are the lessons that
            emerge when you put many experiments together: every forced action
            in onboarding has failed; on-device vision crashes low-RAM Android
            devices; iOS captures roughly 2x the lift of Android. These are
            the patterns Pixmate&rsquo;s PMs encode as institutional rules.
          </p>
          <p>
            Each card below names one pattern, summarizes the lesson, and
            lists the experiments that established it. Click any experiment
            ID to read the full story.
          </p>
        </div>

        <ul
          aria-label="Strength legend"
          className="mt-6 flex flex-col gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-4 text-xs text-[var(--color-fg-muted)]"
        >
          <li className="flex items-baseline gap-2">
            <span className="inline-block h-2 w-2 translate-y-px rounded-full bg-emerald-400" />
            <span>
              <span className="font-mono uppercase tracking-widest text-emerald-400">
                Hardened
              </span>
              {" — "}
              pattern repeatedly confirmed across multiple experiments.
            </span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="inline-block h-2 w-2 translate-y-px rounded-full bg-amber-400" />
            <span>
              <span className="font-mono uppercase tracking-widest text-amber-400">
                Emerging
              </span>
              {" — "}
              two or three confirmations, lesson still forming.
            </span>
          </li>
          <li className="flex items-baseline gap-2">
            <span className="inline-block h-2 w-2 translate-y-px rounded-full bg-[var(--color-fg-muted)]" />
            <span>
              <span className="font-mono uppercase tracking-widest">
                Single instance
              </span>
              {" — "}
              one experiment, watched closely for repeats.
            </span>
          </li>
        </ul>
      </header>

      <section
        aria-label="Patterns"
        className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      >
        {sorted.map((p) => (
          <PatternCard key={p.id} pattern={p} anchorId={p.id} />
        ))}
      </section>
    </main>
  );
}
