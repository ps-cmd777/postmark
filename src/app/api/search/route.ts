// Semantic search endpoint. Single-SSE-endpoint design (Phase 3 plan,
// Q2): one POST that streams `event: results`, then `event: summary`
// deltas, then `event: done`. Two-endpoint handshake would need shared
// state for no UX gain — see plan resolution.

import { z } from "zod";
import { semanticSearch, type SearchHit } from "@/lib/search";
import {
  streamSearchSummary,
  redactSecrets,
  type SearchHitForPrompt,
} from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  query: z.string().min(1).max(500),
  category: z
    .enum([
      "onboarding",
      "pricing",
      "paywall",
      "retention",
      "growth_loop",
      "notification",
      "search",
      "social",
    ])
    .optional(),
  decision: z
    .enum(["shipped", "killed", "iterated", "inconclusive", "reverted"])
    .optional(),
});

function sseEncode(event: string, data: unknown): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  // Split string payloads on newlines per SSE spec.
  const dataLines = payload
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  return new TextEncoder().encode(`event: ${event}\n${dataLines}\n\n`);
}

function toPromptHits(hits: SearchHit[]): SearchHitForPrompt[] {
  return hits.map((h) => ({
    id: h.id,
    title: h.title,
    decision: h.decision,
    lift_percent: h.lift_percent,
    what_we_learned: h.what_we_learned,
  }));
}

export async function POST(req: Request) {
  let parsed;
  try {
    const body = await req.json();
    parsed = RequestSchema.safeParse(body);
  } catch {
    return new Response(
      JSON.stringify({ error: "Body must be valid JSON" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return new Response(
      JSON.stringify({ error: redactSecrets(msg) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const { query, category, decision } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeSend = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          // Client disconnected; nothing to do.
        }
      };

      try {
        const hits = await semanticSearch(query, { category, decision });
        safeSend("results", { hits });

        if (hits.length === 0) {
          safeSend("summary", {
            delta:
              "No experiments in the archive match this query. Try a broader phrasing or remove filters.",
          });
        } else {
          for await (const delta of streamSearchSummary(query, toPromptHits(hits))) {
            safeSend("summary", { delta });
          }
        }

        safeSend("done", { ok: true });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        safeSend("error", { message: redactSecrets(raw) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
