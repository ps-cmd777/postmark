# Postmark

> A living memory of your team's product experiments — with AI that warns you before you repeat a mistake.

## Why this exists

Product teams run dozens of A/B tests per quarter. After each one ends, the readout sits in
Notion or a Statsig dashboard and is essentially forgotten. Six months later, someone proposes
the same test, runs it, gets the same inconclusive result — wasting a quarter of engineering time.

Postmark is the canonical archive of every experiment, with AI that surfaces relevant past
learnings *before* a new experiment is launched.

## What it does

- **Semantic search** across past experiments
- **Pre-flight check** before launching new ones — surfaces risks, similar past tests, sample-size sanity
- **Live Artifacts** for running experiments
- **Senior-analyst critique** on demand
- **Daily brief** of what's launching, running, shipped, learned

## Status

**Phase 1 of 8 — skeleton only.** Database, search, pre-flight, Live Artifacts coming in subsequent phases. See [POSTMARK_PROJECT_BRIEF.md](POSTMARK_PROJECT_BRIEF.md) for the full roadmap.

## Run locally

```bash
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (not yet required for Phase 1)
npm install
npm run dev                  # http://localhost:3000
```

## Built with

Next.js 16 · TypeScript · Tailwind CSS v4 · SQLite (better-sqlite3, Phase 2+) · Anthropic Claude API · Live Artifacts · MCP · Zod

## Honest limitations

- Synthetic seed data (50 experiments, fictional company "Pixmate") — populated in Phase 2
- Single-user, no auth
- Live Artifacts will work for synthetic ticker only — production version would connect to Statsig/Eppo
- Built solo in 14 days with extensive Claude Code assistance — see [CLAUDE.md](CLAUDE.md) for AI context
