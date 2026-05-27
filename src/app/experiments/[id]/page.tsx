// Experiment detail page. RSC, synchronous SQLite read, no API hop.
// All exp_NNN references in hypothesis / what_we_learned are auto-
// linked via <ExperimentLink>. Missing IDs → Next's default 404.

import { notFound } from "next/navigation";
import ExperimentLink from "@/components/ExperimentLink";
import {
  getExperimentById,
  type ExperimentDetail,
} from "@/lib/experiments";
import {
  DECISION_COLOR,
  MUTED,
  formatLift,
  liftColor,
} from "@/lib/chips";

function formatPValue(p: number | null): string {
  if (p === null) return "n/a";
  return p.toFixed(3);
}

// Extract a "verb + subject by amount" clause from the hypothesis prose.
// Catches the common "lift X by Y(pp|%)+" framings the seed corpus uses;
// falls back to "Improve {primary_metric}" when no parseable clause is
// found. Presentational only — never throws.
function deriveGoal(hypothesis: string, primaryMetric: string): string {
  const re =
    /(lift|increase|improve|boost|raise|reduce|drop|cut)\s+([^.,;:\n]{3,80}?)\s+by\s+([\d.]+\s*(?:pp|%)\+?)/i;
  const m = hypothesis.match(re);
  if (!m) return `Improve ${primaryMetric}`;
  const verb = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  const subject = m[2].trim();
  const amount = m[3].replace(/\s+/g, "");
  return `${verb} ${subject} by ${amount}`;
}

function deriveResult(exp: ExperimentDetail): string {
  const { lifecycle, lift_percent, primary_metric } = exp;
  if (lifecycle === "concluded" || lifecycle === "archived") {
    if (lift_percent === null) return "No measurable effect";
    if (lift_percent < 0) {
      return `${primary_metric} dropped ${Math.abs(lift_percent).toFixed(1)}%`;
    }
    return `+${lift_percent.toFixed(1)}% lift on ${primary_metric}`;
  }
  if (lifecycle === "live" || lifecycle === "in_review") return "In progress";
  if (lifecycle === "paused") return "Paused";
  return "Not yet launched"; // draft, scheduled
}

function deriveDecisionDisplay(
  exp: ExperimentDetail,
): { label: string; className: string } {
  if (exp.decision !== null) {
    return { label: exp.decision, className: DECISION_COLOR[exp.decision] };
  }
  if (exp.lifecycle === "paused") {
    return { label: "Under review", className: MUTED };
  }
  return { label: "Pending", className: MUTED };
}

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const exp = getExperimentById(id);
  if (!exp) notFound();

  const decisionClass =
    exp.decision !== null ? DECISION_COLOR[exp.decision] : MUTED;
  const paragraphs = exp.what_we_learned.split(/\n\n+/);

  const goal = deriveGoal(exp.hypothesis, exp.primary_metric);
  const result = deriveResult(exp);
  const decisionDisplay = deriveDecisionDisplay(exp);

  return (
    <main className="mx-auto max-w-[768px] px-6 py-12">
      <header className="border-b border-[var(--color-border)] pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
          {exp.id}
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-[var(--color-fg)] sm:text-4xl">
          {exp.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs">
          <Chip>{exp.category}</Chip>
          <Chip>{exp.lifecycle}</Chip>
          {exp.decision && (
            <Chip className={decisionClass}>{exp.decision}</Chip>
          )}
          <Chip>{exp.team}</Chip>
        </div>
      </header>

      <section
        aria-label="Outcome ribbon"
        className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)]"
      >
        <div className="grid grid-cols-3 divide-x divide-[var(--color-border)]">
          <RibbonCell
            label="Goal"
            value={
              <span className="font-mono text-sm text-[var(--color-fg)]">
                {goal}
              </span>
            }
          />
          <RibbonCell
            label="Result"
            value={
              <span
                className={`font-mono text-sm ${liftColor(exp.lift_percent)}`}
              >
                {result}
              </span>
            }
          />
          <RibbonCell
            label="Decision"
            value={
              <span
                className={`inline-block rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 font-mono text-xs ${decisionDisplay.className}`}
              >
                {decisionDisplay.label}
              </span>
            }
          />
        </div>
      </section>

      <section
        aria-label="Primary metric"
        className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5"
      >
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
          {exp.primary_metric}
        </p>
        <div className="mt-3 flex items-baseline gap-4">
          <span
            className={`font-mono text-3xl font-semibold ${liftColor(exp.lift_percent)}`}
          >
            {formatLift(exp.lift_percent)}
          </span>
          <span className="font-mono text-sm text-[var(--color-fg-muted)]">
            p={formatPValue(exp.p_value)}
          </span>
        </div>
        <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
          {exp.segment}
        </p>
      </section>

      <section aria-label="Hypothesis" className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
          Hypothesis
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--color-fg)]">
          <ExperimentLink text={exp.hypothesis} />
        </p>
      </section>

      <section aria-label="What we learned" className="mt-10">
        <h2 className="text-2xl font-bold tracking-tight text-[var(--color-fg)]">
          What we learned
        </h2>
        <div className="mt-3 flex flex-col gap-4 text-sm leading-7 text-[var(--color-fg)]">
          {paragraphs.map((para, i) => (
            <p key={i}>
              <ExperimentLink text={para} />
            </p>
          ))}
        </div>
      </section>

      <footer className="mt-12 border-t border-[var(--color-border)] pt-6 text-xs text-[var(--color-fg-muted)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            PM: <span className="text-[var(--color-fg)]">{exp.pm}</span>
          </span>
          <span>·</span>
          <span>
            Team: <span className="text-[var(--color-fg)]">{exp.team}</span>
          </span>
          {exp.start_date && (
            <>
              <span>·</span>
              <span>
                Launched:{" "}
                <span className="font-mono text-[var(--color-fg)]">
                  {exp.start_date}
                </span>
              </span>
            </>
          )}
          {exp.end_date && (
            <>
              <span>·</span>
              <span>
                Concluded:{" "}
                <span className="font-mono text-[var(--color-fg)]">
                  {exp.end_date}
                </span>
              </span>
            </>
          )}
        </div>
        {exp.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {exp.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2 py-0.5 font-mono text-[0.7rem] text-[var(--color-fg-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </footer>
    </main>
  );
}

function RibbonCell({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <span className="font-mono text-[0.65rem] uppercase tracking-widest text-[var(--color-fg-muted)]">
        {label}
      </span>
      <div className="leading-tight">{value}</div>
    </div>
  );
}

function Chip({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`rounded border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-2 py-0.5 ${className || "text-[var(--color-fg-muted)]"}`}
    >
      {children}
    </span>
  );
}
