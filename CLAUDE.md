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

**Phase 8 — production prep + Render deploy.** Phases 3–7 shipped on main: semantic search, pre-flight verdict (streaming + Zod-validated tool-use), experiment detail pages with cross-reference links, lessons graph (12 hand-curated patterns), and a TypeScript MCP server exposing the corpus to Claude Desktop. Phase 8 adds in-memory rate limiting on the AI-calling routes, commits the seeded SQLite to the repo, ships render.yaml, writes the real README, and runs the security audit before the public push.

## Deviations from the brief

These are deliberate; the brief predates them. See the appendix in POSTMARK_PROJECT_BRIEF.md for the same notes.

- **Deploy target: Render, not Vercel** (brief §6, §9). Vercel's serverless model doesn't fit `better-sqlite3`'s local file; Render runs a long-running Node process.
- **MCP server: TypeScript + `@modelcontextprotocol/sdk`, not Python + FastMCP** (brief §6, §9, Phase 7). The corpus / retrieval / pattern logic is all in `src/lib`; a TS server imports it directly instead of duplicating it in a Python sidecar.

## Phase 8 — pre-push checklist

Before pushing to public GitHub, run both as a final pass:

- **`/security-review`** — fresh sanity check on the final branch (we did a manual audit in Phase 1, but secrets/RLS/rate-limit drift accumulates).
- **`/simplify`** — review changed code across the whole project for reuse, dead code, and quality issues before a hiring manager reads it.

When wiring up the Anthropic SDK in Phase 2.3+, the **`claude-api`** skill should auto-engage. Let it run — it enforces prompt caching, streaming, and Claude 4.7 conventions the brief mandates anyway.
