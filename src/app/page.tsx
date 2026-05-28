import Link from "next/link";

// Worked-example homepage. The static verdict panel in Section 3
// renders the same shape that /preflight produces live; if the real
// component's classNames drift, mirror them here too.

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      {/* Section 1 — Headline */}
      <section>
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
          postmark
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
          Don&rsquo;t repeat the experiments that already failed.
        </h1>
        <h2 className="mt-4 max-w-2xl text-lg text-[var(--color-fg-muted)]">
          A memory layer for product teams that run experiments.
        </h2>
      </section>

      {/* Section 2 — Picture-this vignette */}
      <section className="mt-16 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
          Picture this
        </p>
        <p className="mt-4 text-base leading-7 text-[var(--color-fg)]">
          A product manager at Pixmate, a photo-editing app, is about to ship a
          feature that requires every new user to verify their phone number
          before they can use the editor. Will it lift retention by reducing
          spam — or tank retention by adding friction? The answer is already in
          the company&rsquo;s experiment history. The PM just can&rsquo;t see
          it.
        </p>
      </section>

      {/* Section 3 — Side-by-side example */}
      <section className="mt-12 grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            The PM asks
          </p>
          <blockquote className="mt-4 border-l-2 border-[var(--color-border)] pl-4 font-mono text-sm italic leading-7 text-[var(--color-fg-muted)]">
            &ldquo;Requiring new users to verify their phone number before
            reaching the editor will reduce spam signups and lift D7 retention
            by 3pp+.&rdquo;
          </blockquote>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            Postmark answers
          </p>

          {/* Mirrors PreflightResult.tsx verdict banner */}
          <div className="rounded-lg border border-rose-900 bg-rose-950/40 p-5 text-rose-100">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="font-mono text-xs uppercase tracking-widest opacity-90">
                High risk
              </span>
              <span className="rounded border border-current/30 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider opacity-90">
                forced action in onboarding
              </span>
            </div>
            <p className="mt-3 text-sm leading-6">
              Mandatory phone verification before the editor is a textbook
              forced-action onboarding wall; corpus shows this pattern
              catastrophically tanks retention. Two prior attempts —{" "}
              <Link
                href="/experiments/exp_010"
                className="font-mono underline decoration-rose-400/40 underline-offset-2 hover:decoration-rose-200"
              >
                exp_010
              </Link>{" "}
              and{" "}
              <Link
                href="/experiments/exp_027"
                className="font-mono underline decoration-rose-400/40 underline-offset-2 hover:decoration-rose-200"
              >
                exp_027
              </Link>{" "}
              — both killed with -36.9% and -10.3% retention impact.
            </p>
          </div>

          <p className="text-xs italic text-[var(--color-fg-muted)]">
            Generated live by Claude from 50 hand-curated experiments in this
            corpus.
          </p>
        </div>
      </section>

      {/* Section 4 — How this works */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight">How this works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              n: 1,
              title: "We've loaded the history",
              body: "50 hand-curated past experiments from Pixmate, with full results, decisions, and what each one taught.",
            },
            {
              n: 2,
              title: "You ask, or paste a hypothesis",
              body: "Search for past tests on any topic, or paste a new idea you're considering testing.",
            },
            {
              n: 3,
              title: "Postmark grounds the answer in real data",
              body: "AI finds the most relevant past experiments and writes you a verdict — citing specific past tests, with real lift numbers and decisions.",
            },
          ].map((step) => (
            <div
              key={step.n}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5"
            >
              <p className="font-mono text-xs text-[var(--color-accent)]">
                {String(step.n).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-base font-semibold leading-snug">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5 — CTAs */}
      <section className="mt-20">
        <h2 className="text-2xl font-bold tracking-tight">Try it</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Link
            href="/preflight"
            className="flex flex-col gap-2 rounded-lg bg-[var(--color-accent)] p-5 text-white transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            <span className="text-base font-semibold">
              Run a pre-flight check →
            </span>
            <span className="text-sm leading-6 text-white/80">
              Paste a hypothesis. Get a risk verdict before you launch.
            </span>
          </Link>
          <Link
            href="/search"
            className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="text-base font-semibold text-[var(--color-fg)]">
              Search past experiments →
            </span>
            <span className="text-sm leading-6 text-[var(--color-fg-muted)]">
              Type a topic. Get the experiments most relevant to it.
            </span>
          </Link>
          <Link
            href="/lessons"
            className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5 transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="text-base font-semibold text-[var(--color-fg)]">
              Browse the lessons →
            </span>
            <span className="text-sm leading-6 text-[var(--color-fg-muted)]">
              See the recurring patterns this company&rsquo;s experiments
              collectively teach.
            </span>
          </Link>
        </div>
      </section>

      {/* Section 6 — Who this is for */}
      <p className="mt-20 max-w-3xl text-xs italic leading-6 text-[var(--color-fg-muted)]">
        Built for product managers and analysts running experiments at consumer
        apps. Demo data is from a fictional photo-editing company called
        Pixmate. Postmark itself is a portfolio project demonstrating Claude +
        RAG + structured AI judgment.
      </p>
    </main>
  );
}
