# Postmark Evals

How I test the AI quality of Postmark's risk verdicts, analysis, and retrieval —
and what building this revealed about the system.

---

## Why this exists

Postmark's core output is *judgment*, not a fixed value. When a user pastes a
hypothesis, the system decides a risk level, cites past experiments, and writes
an analysis. There's no single correct answer to assert against — which means
ordinary unit tests can't cover the part that matters.

So the real question is: if I change a prompt next month to improve the
analysis, how do I know I didn't quietly make the risk assessment worse? Without
a way to measure quality, every prompt change is a guess. This suite is the
measurement. It turns "I think it works" into "here's the number, and I'll know
immediately if it drops."

---

## The design: three layers, because different outputs fail differently

The single most important idea here is that **Postmark produces two kinds of
output that need two kinds of grading**, plus a retrieval step that's tested on
its own.

### Layer 1 — Verdict (deterministic grading)

The verdict is structured: a risk level (`HIGH` / `MEDIUM` / `LOW`) and the
experiments it cites. Structured output is checkable exactly, so this layer
grades like a normal test:

- **Risk level** — exact match against the expected level.
- **Citations** — every required precedent ID must appear; forbidden IDs must
  not. Treated as a *lower bound*: citing extra relevant experiments is fine,
  citing the wrong ones or missing required ones fails.

15 cases: HIGH (failure patterns), LOW (known wins), MEDIUM (ambiguous), plus
3 adversarial cases (see below).

**Baseline: risk 11/12 (92%), citations 14/15 (93%).**

### Layer 2 — Analysis prose (LLM-as-judge)

The analysis is free text — there's no single correct paragraph, so it can't be
graded by exact match. Instead a separate model grades it against a rubric,
scoring 1–5 on:

- **Grounding** — does every factual claim (numbers, outcomes) trace to a cited
  experiment, or is it fabricated?
- **Relevance** — does it actually address *this* hypothesis?
- **Honesty** — when precedent is weak or absent, does it say so rather than
  overclaim?

**Baseline: grounding 5.00, relevance 4.93, honesty 4.93. Zero cases flagged
(≤2 on any axis).**

### Layer 3 — Retrieval (recall@k)

Before writing a verdict, Postmark semantically searches 50 past experiments.
That search can succeed or fail independently, so it's tested separately with
**recall@5**: of the experiments that should surface in the top 5 for a query,
how many did? Single-relevant-item queries are reported as **hit@5** instead,
since recall on a one-item set is just binary and would add noise to the average.

**Baseline: mean recall@5 = 83.3% over 8 multi-item queries; hit@5 = 2/2.**

---

## Adversarial cases: testing that it admits what it doesn't know

Three cases ask about things with no real precedent in the corpus — a
stock-trading dashboard, Vision Pro editing, a backend migration. A tool that
cites data is dangerous if it *fabricates* precedent when it has none. These
cases check that the system declines to invent citations and says plainly that
it has no relevant history. All three passed: zero fabricated citations, each
explicitly acknowledged the weak or absent match.

---

## Two design rules I had to make explicit

Building the cases surfaced two distinctions that aren't obvious until you hit
them:

**Citation vs. retrieval have different inclusion rules — on purpose.**
A verdict should only *cite* experiments that have a decided outcome; you can't
present an unfinished experiment as evidence. But *retrieval* should surface
anything topically relevant, decided or not — a user searching a topic wants to
see in-flight work too. Same corpus, two different "what counts as relevant"
rules, because citation and search do different jobs.

**Ground truth must reflect the system's actual logic, not a rule I invented.**
(See the first finding below — this one cost me half my initial score.)

---

## What building this revealed

The point of an eval isn't a passing score. It's the gap between what you
*assume* your system does and what it *actually* does. Every item below is
something the suite caught that manual testing had not.

**1. My mental model of my own system was wrong.**
The first run scored 6/12 on risk. Digging in, the model was mostly *right* — my
expected answers were wrong. I'd encoded a "one negative precedent → MEDIUM"
heuristic, but the system's actual logic is "does a named anti-pattern match →
HIGH." Five cases I'd marked MEDIUM were correctly HIGH. I fixed the ground
truth and the score jumped to 11/12. The eval corrected *me*, not the model.

**2. The judge caught a real product bug the deterministic layer couldn't.**
On an adversarial case, the analysis prose was cut off mid-word ("discovery-ph").
The structured verdict was fine, so Layer 1 passed it — but the judge's relevance
score dipped and the note traced it to output truncation. Root cause:
`ANALYSIS_MAX_TOKENS=600` is too low for some analyses. This is a user-facing bug
in production, found automatically. (Fix tracked separately — detection and fix
kept as two commits.)

**3. A documented model limitation: over-confidence on in-flight data.**
One case (Mexico SPEI referral) I expected MEDIUM; the model said LOW. The judge
scored its honesty 4/5 and explained why: the analysis leaned on an experiment
that is only *scheduled* — using an unconducted experiment to justify confidence
in a proposal that mirrors it. I kept this as an intentional, logged miss rather
than papering over it. A stricter "decided-evidence-only" honesty rubric would
score it lower and surface it harder.

**4. LLM output is non-deterministic — a single run is a sample, not a
measurement.**
One citation case passed on the first run and failed on the second, with
identical input and no code change. The model simply cited one precedent instead
of two that time. This is the nature of LLMs. The honest consequence: to know a
true pass rate you run boundary cases N times and threshold on pass *frequency*,
not a single result. (I relaxed that case's requirement — but only because the
second citation genuinely wasn't necessary to establish the risk, not merely to
make the test pass. Relaxing a case just because it failed would be overfitting
the eval to the model.)

**5. Verdict quality is bounded by retrieval quality.**
Two retrieval blind spots showed up: the archetypal killed forced-action
experiment doesn't surface for "onboarding friction blocking new users," and the
onboarding fast-path experiment doesn't surface for tutorial-skip queries. Layer
3 and Layer 1 corroborated each other — the verdict can't cite what search
didn't surface. The lever here is embedding/query tuning, not the prompt.

**6. Citations aren't structured data.**
The verdict object exposes risk level and a summary but no citations field —
citations live only as `[exp_XXX]` tokens inside the prose. Grading them meant
regex-extracting from the stream. A production hardening would add a
`cited_experiments` field to the verdict schema so downstream code could use
citations programmatically.

---

## Model migration note (4.7 → 4.8)

Migrated the verdict model from claude-opus-4-7 to claude-opus-4-8.
Aggregate eval scores held flat: risk 11/12, citations 14/15, retrieval
recall@5 83.3%, judge grounding/relevance 5.00/4.93, honesty 4.93→5.00.
But two citation cases flipped in opposite directions — eval_003
(fail→pass) and eval_009 (pass→fail) — netting to the same score. This
is consistent with Anthropic's note that minor versions can shift
behavior, plus run-to-run non-determinism (eval_003 is a known
non-deterministic case). The persistent eval_008 miss held across both
versions, confirming it's a corpus/prompt characteristic, not a
model-version artifact. Both 4.7 and 4.8 result sets are in results/ for
comparison. Takeaway: the eval suite let me migrate models and verify
no regression in minutes.

---

## Running it

```bash
npm run eval:verdict      # Layer 1 — deterministic verdict grading
npm run eval:retrieval    # Layer 3 — recall@5 / hit@5
npm run eval:judge        # Layer 2 — LLM-as-judge on analysis prose
```

Each writes a timestamped report to `evals/results/`. The `--limit N` flag runs
a subset (useful for controlling API cost during development). Baselines for
2026-07-03 are saved in `evals/results/`.

---

## How I'd use this going forward

- **Before shipping a prompt change:** re-run all three layers, compare to the
  saved baseline, don't ship if any layer regresses.
- **For flaky/boundary cases:** run N times, threshold on pass frequency.
- **When adding corpus experiments:** add retrieval cases so search coverage is
  tracked as the corpus grows.

The suite is small (15 verdict + 10 retrieval cases) by design — small enough to
run often and cheap enough to run on every meaningful change. Coverage of the
common risk patterns matters more than raw case count.
