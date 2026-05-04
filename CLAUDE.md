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

**Phase 1 — Skeleton.** Next.js 16 + Tailwind v4 + TS, folder structure per brief §8, dark theme, hero page, CI. Database, embeddings, search, pre-flight, Live Artifacts, MCP, evals all come in later phases.
