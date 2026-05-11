# Postmark — Master Project Brief

> **For Claude Code:** This document is the source of truth for the Postmark project. Read this in full at the start of every session. Do not deviate from the architecture or scope without explicit user approval.

---

## 1. Project identity

**Name:** Postmark

**Tagline:** A living memory of your team's product experiments — with AI that warns you before you repeat a mistake.

**Type:** Web application, deployed publicly, with a synthetic seed archive of 50 past experiments.

**Target users:** Product Managers, Product Analysts, Growth Analysts at startups and growth-stage companies.

**Time budget:** 14 days from Monday May 4, 2026.

**Builder:** Shush — Growth & Automation Analyst with 6+ years of experience at consumer tech companies. Building this solo with extensive Claude Code assistance. Python and SQL background; basic Next.js / TypeScript familiarity.

---

## 2. The problem Postmark solves

Product teams run dozens of A/B tests per quarter. After each experiment ends, the readout sits in Notion or a Statsig/Eppo dashboard and is essentially forgotten. Six months later, someone proposes the same test, runs it, and gets the same inconclusive result — wasting a quarter of engineering time.

**The four specific failure modes:**

1. **"Did we test this before?"** — Existing tools (Statsig, Eppo, Optimizely) store experiments but search is keyword-only and shallow. Semantic similarity is impossible.
2. **PRDs go stale.** Written in Notion, never updated when actual experiment results arrive.
3. **PRD → readout loop is broken.** Success criteria are written, then never checked.
4. **Tribal knowledge dies with senior people.** "Don't ship onboarding tests in December — novelty effect is too strong" is the kind of insight one senior analyst knows and 15 PMs don't.

**Postmark fixes all four** by being the single canonical archive of every experiment, with AI that surfaces relevant past learnings *before* a new experiment is launched.

---

## 3. The competitive landscape (why this is novel)

| Competitor | What they do | Gap they leave |
|---|---|---|
| **ChatPRD** | AI writes new PRDs | Doesn't search past experiments or capture lessons |
| **Statsig / Eppo / GrowthBook** | Run experiments, store results | Keyword search only, no AI synthesis, no pre-flight |
| **Notion AI** | General writing assistant | Not experiment-aware |
| **Productboard** | Roadmap + feedback management | Doesn't touch experimentation |

**Nobody owns "AI memory of past experiments."** This is genuine empty space in 2026.

---

## 4. The 6 core features

| # | Feature | Description |
|---|---------|-------------|
| **F1** | **Semantic search** | "Have we tested anything around onboarding?" → returns ranked past experiments with AI-written summaries |
| **F2** | **Pre-flight check** | Paste a hypothesis for a NEW experiment → Postmark scans archive + lessons, returns risks, similar past tests, sample size sanity check |
| **F3** | **Living readout (Live Artifact)** | Each experiment's status page auto-refreshes with current data while the test runs. Built using Anthropic's Live Artifacts (released April 20, 2026). |
| **F4** | **Lessons graph** | AI extracts and tags lessons across all experiments. "Novelty effects appeared in 4 onboarding tests" — meta-pattern surfacing. |
| **F5** | **Senior-analyst critique** | Click any past readout → AI critiques it as a senior analyst would (sample size adequacy, segment imbalance, statistical concerns). |
| **F6** | **Daily brief** | A morning summary: what's launching, what's running, what shipped, what was learned yesterday. |

**Priority order for the 14-day build:** F1 → F2 → F3 → F4 → F5 → F6.

If running short on time, ship F1 + F2 + F3 only. Those are the magic.

---

## 5. The fictional company context for seed data

The 50-experiment seed archive is built around a fictional company: **"Pixmate"** — a creative consumer app for photo editing and short-form video. ~30M monthly active users, freemium model with paid Pro tier, mobile-first (iOS + Android), web companion.

This context is invisible to users of Postmark — but it gives the seed experiments natural coherence.

---

## 6. Tech stack (deliberately boring)

The product cleverness is in the design, not infrastructure.

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) + TypeScript + Tailwind CSS | Standard 2026 stack, deployable to Vercel, Claude Code is excellent at it |
| **Backend** | Next.js API routes (no separate server) | Keep it simple, one deploy unit |
| **Database** | SQLite via better-sqlite3 (local file) | No external DB to manage, ships with seed data baked in |
| **Vector search** | sqlite-vec extension OR simple cosine over stored embeddings | Lightweight, no Pinecone/Weaviate needed |
| **Embeddings** | Voyage AI (voyage-3-large, 1024 dimensions) | Voyage is Anthropic's officially recommended embedding partner; pairs cleanly with Claude for generation. Anthropic does not sell embeddings directly. |
| **LLM** | Anthropic Claude API (claude-opus-4-7 for synthesis, claude-haiku-4-5 for routine tasks) | Cost-tuned |
| **Live Artifacts** | Anthropic Live Artifacts API | The 2026 differentiator |
| **MCP** | Custom Python MCP server (Phase 5 only) using FastMCP | Adds protocol-layer signal |
| **Deployment** | Vercel for frontend + API, custom domain | One-click deploy |
| **CI** | GitHub Actions — lint + typecheck on push | Standard hygiene |
| **Tests** | Vitest for unit tests, Playwright optional for E2E | Don't over-test in 14 days |

**Explicitly NOT using:** LangChain, LlamaIndex, Pinecone, Supabase, Postgres, Redis, Docker. They add complexity without earning their place at this scope.

---

## 7. Data model

### Experiment

```ts
interface Experiment {
  id: string;                    // "exp_001"
  title: string;                 // "Onboarding tutorial video for new free users"
  hypothesis: string;            // Full hypothesis statement
  category: ExperimentCategory;  // onboarding | pricing | paywall | retention | growth_loop | notification | search | social
  lifecycle: 'draft' | 'in_review' | 'scheduled' | 'live' | 'paused' | 'concluded' | 'archived';
  decision: 'shipped' | 'killed' | 'iterated' | 'inconclusive' | 'reverted' | null;
  // decision is null until lifecycle === 'concluded'. Enforced by Zod at the data boundary (Phase 2).
  start_date: string;            // ISO date
  end_date: string | null;       // ISO date or null if lifecycle is not yet concluded
  duration_days: number;
  segment: string;               // "Free users, iOS, US"
  segment_size: number;          // 245000
  primary_metric: string;        // "D7 retention"
  primary_metric_baseline: number;
  primary_metric_treatment: number;
  lift_percent: number;          // 3.1
  p_value: number;               // 0.04
  sample_size: number;
  guardrail_metrics: GuardrailMetric[];
  segment_breakdown: SegmentResult[];
  what_we_learned: string;       // 1-3 sentences, the lesson
  failure_modes: FailureMode[];  // ["novelty_effect"]
  team: string;                  // "Growth"
  pm: string;                    // "Maria Chen" (fictional)
  embedding: number[];           // 768-dim vector for semantic search
  tags: string[];                // ["onboarding", "video", "ios"]
}

interface GuardrailMetric {
  name: string;
  baseline: number;
  treatment: number;
  delta_percent: number;
  status: 'pass' | 'warn' | 'fail';
}

interface SegmentResult {
  segment: string;
  lift_percent: number;
  p_value: number;
  sample_size: number;
}

type FailureMode =
  | 'novelty_effect'
  | 'sample_ratio_mismatch'
  | 'simpsons_paradox'
  | 'instrumentation_drift'
  | 'underpowered'
  | 'segment_imbalance'
  | 'seasonality'
  | 'multiple_testing'
  | 'survivorship_bias';

type ExperimentCategory =
  | 'onboarding'
  | 'pricing'
  | 'paywall'
  | 'retention'
  | 'growth_loop'
  | 'notification'
  | 'search'
  | 'social';
```

### Lesson

```ts
interface Lesson {
  id: string;
  pattern: string;               // "Novelty effects in onboarding tests"
  description: string;           // Full explanation
  related_experiment_ids: string[];
  category: ExperimentCategory[];
  severity: 'critical' | 'important' | 'note';
  detection_query: string;       // How Claude should detect this in a new hypothesis
}
```

### PreflightCheck

```ts
interface PreflightCheck {
  hypothesis: string;
  similar_experiments: ExperimentMatch[];
  detected_failure_modes: DetectedFailureMode[];
  sample_size_recommendation: SampleSizeRec;
  confidence: number;            // 0-1
  suggested_window_days: number;
}

interface ExperimentMatch {
  experiment_id: string;
  similarity_score: number;
  why_relevant: string;          // AI-generated 1-sentence explanation
}

interface DetectedFailureMode {
  mode: FailureMode;
  reason: string;
  recommendation: string;
}
```

---

## 8. Folder structure

```
postmark/
├── README.md                    # Public-facing
├── CLAUDE.md                    # AI context (this file's principles)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vercel.json
├── .env.example                 # ANTHROPIC_API_KEY only
├── .gitignore
├── data/
│   ├── experiments.json         # 50 seed experiments
│   ├── lessons.json             # 12-15 lesson patterns
│   └── postmark.db              # SQLite, generated on build
├── scripts/
│   ├── seed.ts                  # Loads JSON into SQLite, generates embeddings
│   ├── generate-embeddings.ts
│   └── add-experiment.ts        # CLI helper for adding experiments
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Search homepage
│   │   ├── experiment/[id]/page.tsx   # Experiment detail (Live Artifact)
│   │   ├── preflight/page.tsx   # Pre-flight check
│   │   ├── lessons/page.tsx     # Lessons graph
│   │   ├── brief/page.tsx       # Daily brief
│   │   └── api/
│   │       ├── search/route.ts
│   │       ├── preflight/route.ts
│   │       ├── critique/route.ts
│   │       ├── brief/route.ts
│   │       └── live/route.ts    # Live Artifact data endpoint
│   ├── components/
│   │   ├── SearchBar.tsx
│   │   ├── ExperimentCard.tsx
│   │   ├── PreflightResult.tsx
│   │   ├── LiveStatus.tsx       # The Live Artifact component
│   │   ├── LessonsGraph.tsx
│   │   └── ui/                  # Reusable primitives
│   ├── lib/
│   │   ├── claude.ts            # Anthropic client wrapper
│   │   ├── embeddings.ts
│   │   ├── search.ts            # Semantic + filter search
│   │   ├── preflight.ts         # Pre-flight check logic
│   │   ├── critique.ts          # Senior-analyst critique
│   │   ├── live-artifacts.ts    # Live Artifact integration
│   │   └── db.ts                # SQLite client
│   ├── types/
│   │   └── index.ts             # All types from §7 above
│   └── styles/
│       └── globals.css
├── tests/
│   ├── search.test.ts
│   ├── preflight.test.ts
│   └── eval-set.json            # 30-question eval suite
├── docs/
│   ├── architecture.md
│   ├── eval-results.md
│   └── why-each-tech-choice.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 9. Build phases (phased handoff to Claude Code)

**Critical:** Claude Code should build phase by phase. Do NOT attempt all phases at once. Each phase ends with a deployable, testable state.

### Phase 1 — Skeleton (Days 1–2)

**Goal:** Empty Next.js app deployed to Vercel.

- Init Next.js 15 + TypeScript + Tailwind
- Add the folder structure from §8 (empty files OK)
- Set up `tailwind.config.ts` with a clean professional theme: dark mode default, neutral grays, blue accent
- Build `src/app/layout.tsx` with header (Postmark logo + nav) and `page.tsx` with placeholder hero
- Set up `.env.example` with `ANTHROPIC_API_KEY=`
- Connect GitHub repo → Vercel auto-deploy
- Add GitHub Actions: lint + typecheck on push

**Deliverable:** A live URL showing the Postmark hero page.

### Phase 2 — Database + seed (Days 3–4)

**Goal:** SQLite database loaded with 50 experiments + 15 lessons. Embeddings generated.

- Set up `better-sqlite3`
- Build `scripts/seed.ts` that reads `data/experiments.json` and `data/lessons.json` into SQLite
- Build `scripts/generate-embeddings.ts` that calls Anthropic embeddings API for each experiment's title + hypothesis + what_we_learned, stores as Float32 blob in DB
- Add a simple API route `/api/health` that returns experiment count

**Deliverable:** SQLite has 50 experiments + embeddings. Health endpoint returns `{ experiments: 50, lessons: 15 }`.

### Phase 3 — Semantic search F1 (Days 5–6)

**Goal:** Search homepage works.

- Build `src/lib/search.ts`: takes a query string, embeds it, computes cosine similarity against all experiment embeddings, returns top 5
- Build `/api/search/route.ts` POST endpoint
- Build `SearchBar.tsx` component with streaming Claude synthesis ("Here are the 3 most relevant past experiments...")
- Build `ExperimentCard.tsx` showing title, lift, decision, what_we_learned, segment
- Wire up homepage `page.tsx` to use these
- Add filters: category, decision (shipped/killed/inconclusive)

**Deliverable:** User can ask "have we tested anything about onboarding?" and get ranked results with AI summary.

### Phase 4 — Pre-flight check F2 (Days 7–8) — KEY FEATURE

**Goal:** The killer feature works.

- Build `/preflight` page with a textarea: "Paste your experiment hypothesis"
- Build `src/lib/preflight.ts`:
  - Embed the hypothesis
  - Find top 3 similar past experiments
  - For each lesson in `lessons.json`, run Claude with `detection_query` to check if it applies
  - Run sample-size sanity check (Claude evaluates if the proposed sample is adequate)
  - Return structured `PreflightCheck` (Pydantic-style validation via Zod)
- Build `PreflightResult.tsx` component showing risks, similar experiments, recommendations
- Add a "Pre-flight check" CTA to the homepage

**Deliverable:** Paste a hypothesis → get a structured report of risks and similar past tests.

### Phase 5 — Live Artifact (Days 9–10)

**Goal:** Experiment status pages auto-refresh as Live Artifacts.

- Build `/experiment/[id]` page showing full experiment detail
- For experiments with `lifecycle: 'live'`, render the status panel as a Live Artifact via Anthropic's Live Artifacts API
- Synthetic data ticker simulates real-time updates (current lift, current p-value, current sample)
- Document this clearly in the README — it's the 2026 differentiator

**Deliverable:** Open a running experiment → see Live Artifact that auto-refreshes.

### Phase 6 — Critique + Lessons + Brief (Days 11–12)

**Goal:** Round out F4, F5, F6.

- Critique button on experiment detail page → Claude analyzes for sample-size, segment-imbalance, statistical concerns → returns 3-paragraph critique
- `/lessons` page showing all 15 patterns with related experiment links
- `/brief` page generating a daily summary using Claude

### Phase 7 — MCP server (Days 12–13, optional)

**Goal:** Add the protocol-layer signal.

- Build a small Python MCP server using FastMCP
- Expose tools: `search_experiments`, `preflight_check`, `get_experiment`
- Document in README how to connect to Claude Desktop
- This is optional — only do if Phase 1–6 are done

**Deliverable:** `claude mcp add postmark` works on Claude Desktop.

### Phase 8 — Polish + launch (Days 13–14)

- README with screenshots, demo GIF, architecture diagram, "Why each tech choice" doc
- 90-second Loom demo
- Custom domain
- Eval results published to `docs/eval-results.md` (run the 30-question eval suite, document accuracy)
- Submit to: r/ProductManagement, r/datascience, r/ClaudeAI, Hacker News, LinkedIn

---

## 10. UI / UX principles

Postmark must look like a real product, not a toy.

- **Dark mode default.** White-on-dark like Linear, Vercel, Statsig.
- **Information density.** PMs and analysts are power users — don't be sparse.
- **Monospace for IDs and numbers** (`exp_042`, `+3.1%`, `p=0.04`).
- **No emojis in product UI.** This is a serious tool. Emojis OK in marketing/README.
- **Cmd+K everywhere.** Search-first UX. Cmd+K from any page opens search.
- **Citations always visible.** When AI summarizes, show source experiment IDs as clickable chips.
- **Loading states.** Use shimmer skeletons, not spinners.
- **Streaming.** All AI responses stream token-by-token.

**Use Claude Design** for the initial UI generation — describe the homepage and let Claude produce the React/Tailwind. Then iterate.

---

## 11. AI architecture decisions

Document these in `docs/why-each-tech-choice.md` because this is what hiring managers will read.

**Why RAG, not fine-tuning:**
- The archive is small (50 docs) and changes frequently
- Fine-tuning would lose specificity of source attribution
- RAG lets us cite exact experiment IDs

**Why semantic search, not keyword:**
- "Onboarding friction" should match an experiment titled "First-session drop-off reduction"
- Keyword would miss this; embeddings catch it

**Why Anthropic embeddings:**
- Single vendor for embeddings + LLM = simpler key management
- Quality is comparable to OpenAI text-embedding-3-small for this use case

**Why structured outputs (Zod schemas):**
- Pre-flight check needs deterministic structure for UI rendering
- Catching malformed AI responses early is critical for production-grade signal

**Why MCP:**
- Demonstrates protocol-layer understanding
- Makes Postmark accessible from Claude Desktop, not just the web app
- 2026 differentiator

**Why Live Artifacts:**
- Built into Anthropic's platform, no custom infrastructure
- Solves the "stale doc" problem PMs complain about
- First-mover signal (released 11 days ago)

---

## 12. Eval suite

A 30-question eval set lives in `tests/eval-set.json`. Each question has a hypothesis, expected matched experiment IDs, and expected detected failure modes. Phase 8 includes running this and publishing accuracy.

**Why this matters:** "I built it and it works" is 2024. "Here's the accuracy on a held-out eval set" is 2026 hiring signal.

Sample structure:

```json
{
  "id": "eval_001",
  "input_hypothesis": "Adding a 30-second tutorial video on first launch will lift D7 retention by 2pp for free iOS users",
  "expected_similar_experiment_ids": ["exp_007", "exp_023"],
  "expected_failure_modes": ["novelty_effect"],
  "expected_sample_size_concern": false
}
```

---

## 13. README structure (for the public repo)

```markdown
# Postmark

> A living memory of your team's product experiments — with AI that warns you before you repeat a mistake.

[Demo GIF — top of README]

## Why I built this
[2 paragraphs: the analyst-watching-teams-repeat-mistakes story]

## What it does
- Semantic search across past experiments
- Pre-flight check before launching new ones
- Live Artifacts for running experiments
- Senior-analyst critique on demand

## Live demo
[link to Vercel deployment]

## Architecture
[Mermaid diagram showing: Next.js → API routes → SQLite + embeddings → Claude API + Live Artifacts]

## Why each tech choice
[Link to docs/why-each-tech-choice.md]

## Eval results
[Link to docs/eval-results.md, headline number: "84% precision on 30-question eval set"]

## Run it locally
[3 commands]

## Built with
Next.js · TypeScript · Tailwind · SQLite · Anthropic Claude API · Live Artifacts · MCP · Zod

## Honest limitations
- Synthetic seed data (50 experiments, fictional company "Pixmate")
- Single-user, no auth
- Live Artifacts work for synthetic ticker only — production version would connect to Statsig/Eppo
- Built solo in 14 days with extensive Claude Code assistance — see CLAUDE.md for AI context
```

---

## 14. Out of scope (do not build)

To keep the 14-day budget intact, Claude Code MUST NOT build:

- User authentication / multi-tenancy
- Real Statsig/Eppo integration (Phase 5+ is fictional ticker only)
- Mobile app
- Email/Slack notifications
- Comments/collaboration features
- Export to PDF
- Versioning of experiment edits
- Audit logs
- Admin dashboard

If a future user requests one of these, defer with: "Out of scope for v1. Could be a future feature."

---

## 15. Definition of done

By Day 14, the following must be true:

- [ ] Public URL on custom domain works
- [ ] Search returns relevant results in <2s
- [ ] Pre-flight check produces structured output with citations
- [ ] At least one experiment shows a working Live Artifact
- [ ] Eval suite has been run and results published
- [ ] README includes demo GIF, architecture, eval numbers, "honest limitations" section
- [ ] 90-second Loom demo recorded
- [ ] Submitted to at least 3 communities (Reddit + LinkedIn + one more)

---

## 16. Files Claude Code will receive

In addition to this brief, Claude Code will receive:

1. `data/experiments.json` — 50 seed experiments
2. `data/lessons.json` — 12–15 lesson patterns
3. `tests/eval-set.json` — 30-question eval suite

These will be provided in subsequent messages.

---

## 17. Working norms

- **Always read this brief at the start of every session.**
- **Do not introduce new dependencies without flagging.** Especially: no LangChain, LlamaIndex, Pinecone, or vector DBs beyond sqlite-vec.
- **Phase discipline.** Finish Phase N before starting N+1. If a Phase 4 task requires Phase 5 work, stop and ask.
- **Honest limitations.** When something is mocked or synthetic, label it clearly in code comments and README.
- **Streaming everywhere.** All AI responses must stream.
- **Small commits.** One feature per commit, conventional commits format (`feat:`, `fix:`, `docs:`).
- **Type safety.** No `any`. Use Zod for runtime validation of AI responses.
- **Secrets.** Never commit `.env`. Always use `.env.example`.

---

## 18. The story this project tells

When a hiring manager opens this repo, they should think:

> "This person worked in growth analytics. They identified a real workflow pain. They built something that solves it using a thoughtful 2026 stack — RAG, MCP, Live Artifacts, evals. The architecture choices are documented and justified. The code is clean. The README is honest about what's mocked. They shipped solo in 14 days with AI assistance, and they're transparent about that. This is the analyst-builder profile we've been looking for."

That's the bar. Don't aim lower.

---

*End of master brief. Read in full before each session.*
