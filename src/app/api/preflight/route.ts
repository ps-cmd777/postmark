// Pre-flight check endpoint. SSE stream mirroring Phase 3's shape:
//   event: precedents  -> retrieved top-K experiments (always first)
//   event: verdict     -> structured tool-use output (risk + summary + pattern)
//   event: analysis    -> streaming prose deltas
//   event: done        -> end of stream
//   event: error       -> redacted error message
//
// Once verdict ships we never revoke it. If the analysis stream errors
// mid-way, an event:error appended after partial deltas is rendered by
// the client as an inline banner below whatever streamed.

import { z } from "zod";
import { streamPreflight } from "@/lib/preflight";
import { redactSecrets } from "@/lib/redact";
import {
  PREFLIGHT_LIMIT,
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  hypothesis: z.string().min(20).max(2000),
});

function sseEncode(event: string, data: unknown): Uint8Array {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  const dataLines = payload
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  return new TextEncoder().encode(`event: ${event}\n${dataLines}\n\n`);
}

export async function POST(req: Request) {
  // Rate limit BEFORE parsing — cheap path first, avoids any Opus
  // spend on bursts. Returns 429 with retry-after; the client's
  // existing non-2xx JSON handler renders this as an error banner.
  const limit = checkRateLimit(req, PREFLIGHT_LIMIT);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

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
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return new Response(
      JSON.stringify({ error: redactSecrets(msg) }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const { hypothesis } = parsed.data;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeSend = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseEncode(event, data));
        } catch {
          // client disconnected
        }
      };

      try {
        for await (const ev of streamPreflight(hypothesis)) {
          if (ev.type === "precedents") {
            safeSend("precedents", { hits: ev.hits });
          } else if (ev.type === "verdict") {
            safeSend("verdict", ev.verdict);
          } else if (ev.type === "analysis-delta") {
            safeSend("analysis", { delta: ev.delta });
          } else if (ev.type === "error") {
            safeSend("error", { message: ev.message });
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
