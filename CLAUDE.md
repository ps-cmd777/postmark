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

## Project status

**Shipped.** All phases complete. Live at https://postmark-demo.onrender.com, public repo at github.com/ps-cmd777/postmark. Three production patch cycles applied (see "Post-deploy patches" below).

Phases completed:
- Phase 1 — Brief, schema, seed data (50 experiments)
- Phase 2 — Voyage embeddings + sqlite-vec retrieval
- Phase 3 — Semantic search with Haiku summaries
- Phase 4 — Pre-flight verdict (Opus tool-use + streaming)
- Phase 5 — Experiment detail pages with cross-references
- Phase 6 — Lessons graph (12 hand-curated patterns) + homepage redesign
- Phase 7 — MCP server (TS-SDK)
- Phase 8 — Rate limiting, security audit, Render deploy, README

## Deviations from the brief

These are deliberate; the brief predates them. See the appendix in POSTMARK_PROJECT_BRIEF.md for the same notes.

- **Deploy target: Render, not Vercel** (brief §6, §9). Vercel's serverless model doesn't fit `better-sqlite3`'s local file; Render runs a long-running Node process.
- **MCP server: TypeScript + `@modelcontextprotocol/sdk`, not Python + FastMCP** (brief §6, §9, Phase 7). The corpus / retrieval / pattern logic is all in `src/lib`; a TS server imports it directly instead of duplicating it in a Python sidecar.

## Post-deploy patches

Three production patch cycles applied in the first 24 hours after deploy:

1. **Health check 429** (aa570da). Render's load balancer health checks hit the rate limiter, triggered 429 responses, caused false-positive unavailability alerts. Fix: removed rate-limiting from /api/health entirely. Health endpoints should never be rate-limited.

2. **Build environment dev-deps** (5e07b4a). Render runs npm install with NODE_ENV=production, which skips devDependencies. Next.js build needed typescript, @tailwindcss/postcss, and @types/* at build time. Fix: changed buildCommand to `npm ci --include=dev && npm run build`. Note: Render's dashboard had a separate buildCommand override taking precedence over render.yaml — had to update both.

3. **Rate-limit XFF rotation** (752003c). Diagnostic logging revealed that on Render+Cloudflare, the last value in x-forwarded-for is Render's internal load-balancer IP, which rotates per request. The standard "take last value" defense against client spoofing produced per-request bucket churn. Fix: take FIRST value of XFF instead. Render+Cloudflare overwrite any client-supplied XFF upstream, so first-value is the trustworthy real-client IP.
