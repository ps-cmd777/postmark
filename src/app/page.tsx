import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-accent)]">
        postmark
      </p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        A living memory of your team&rsquo;s product experiments.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-[var(--color-fg-muted)]">
        Search past A/B tests by meaning, not keywords. Get a pre-flight check before you
        launch a new one. Surface the lessons your senior analysts already learned.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <button
          disabled
          className="cursor-not-allowed rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-2.5 text-left text-sm text-[var(--color-fg-muted)]"
        >
          <span className="font-mono text-[var(--color-fg-muted)]">⌘K</span>
          &nbsp;&nbsp;Search experiments — coming Phase 3
        </button>
        <Link
          href="/preflight"
          className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Pre-flight check →
        </Link>
      </div>

      <section className="mt-20 grid gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-3">
        {[
          {
            label: "F1 · Semantic search",
            body: "Ranked results across 50 past experiments with AI-written summaries.",
          },
          {
            label: "F2 · Pre-flight check",
            body: "Paste a hypothesis. Postmark surfaces risks, similar tests, sample-size sanity.",
          },
          {
            label: "F3 · Live Artifact",
            body: "Running experiments stream current lift, p-value, and sample as a Live Artifact.",
          },
        ].map((card) => (
          <div key={card.label} className="bg-[var(--color-bg)] p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
              {card.label}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-fg)]">{card.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-12 font-mono text-xs text-[var(--color-fg-muted)]">
        v0.0.1 · phase 1 of 8 · synthetic seed
      </p>
    </main>
  );
}
