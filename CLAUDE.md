# Postmark — AI context

The source of truth for this project is [POSTMARK_PROJECT_BRIEF.md](POSTMARK_PROJECT_BRIEF.md).
**Read it in full at the start of every session.** Do not deviate from architecture or scope without explicit user approval.

## Working norms (brief §17)

- **Phase discipline.** Finish Phase N before starting N+1. If a Phase 4 task requires Phase 5 work, stop and ask.
- **No new dependencies without flagging.** Especially: no LangChain, LlamaIndex, Pinecone, or vector DBs beyond `sqlite-vec`.
- **Honest limitations.** Label mocked or synthetic data clearly in code comments and the README.
- **Streaming everywhere.** All AI responses must stream.
- **Small commits.** One feature per commit. Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
- **Type safety.** No `any`. Use Zod for runtime validation of AI responses.
- **Secrets.** Never commit `.env`. Always use `.env.example`.

## Out of scope (brief §14)

Auth, multi-tenancy, real Statsig/Eppo integration, mobile app, email/Slack notifications, comments, PDF export, versioning, audit logs, admin dashboard. Defer with: "Out of scope for v1."

## Current phase

**Phase 2 — DB + seed data.** SQLite + sqlite-vec scaffolded, schema migrated, `/api/health` returns real counts. Seed data being built in batches (batch 1 = exp_001–010, hand-curated; remaining 40 to follow). Embeddings (Voyage `voyage-3-large`, 1024 dims) and Zod validators come next.

## Phase 8 — pre-push checklist

Before pushing to public GitHub, run both as a final pass:

- **`/security-review`** — fresh sanity check on the final branch (we did a manual audit in Phase 1, but secrets/RLS/rate-limit drift accumulates).
- **`/simplify`** — review changed code across the whole project for reuse, dead code, and quality issues before a hiring manager reads it.

When wiring up the Anthropic SDK in Phase 2.3+, the **`claude-api`** skill should auto-engage. Let it run — it enforces prompt caching, streaming, and Claude 4.7 conventions the brief mandates anyway.
