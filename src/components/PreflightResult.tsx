"use client";

// Streams /api/preflight SSE and renders three sections in order:
//   1. Verdict banner (colored by risk_level) — top
//   2. Streaming analysis prose with citation chips — middle
//   3. Precedent cards (reusing ExperimentCard) — bottom
//
// Verdict-first invariant: precedents render under an empty verdict
// slot so the page is never blank; the banner pops in the moment the
// tool-use stream completes. If analysis errors mid-way, the error
// banner appends below — we never revoke the shipped verdict.

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { SearchHit } from "@/lib/search";
import type { Verdict } from "@/lib/preflight";
import ExperimentCard from "./ExperimentCard";

interface Props {
  onStreamingChange?: (streaming: boolean) => void;
}

export interface PreflightResultHandle {
  run: (hypothesis: string) => void;
}

interface ParsedEvent {
  event: string;
  data: string;
}

async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<ParsedEvent, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
      }
      yield { event, data: dataLines.join("\n") };
    }
  }
}

function renderWithCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /\[(exp_\d{3})\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <span
        key={`cite-${i++}`}
        className="mx-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[0.75rem] text-[var(--color-accent)]"
      >
        {match[1]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const RISK_STYLES: Record<Verdict["risk_level"], string> = {
  low: "border-emerald-900 bg-emerald-950/40 text-emerald-100",
  medium: "border-amber-900 bg-amber-950/40 text-amber-100",
  high: "border-rose-900 bg-rose-950/40 text-rose-100",
};

const RISK_DOT: Record<Verdict["risk_level"], string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

const RISK_LABEL: Record<Verdict["risk_level"], string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const PreflightResult = forwardRef<PreflightResultHandle, Props>(function PreflightResult(
  { onStreamingChange },
  ref,
) {
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const reqIdRef = useRef(0);

  const runPreflight = useCallback(async (h: string) => {
    const reqId = ++reqIdRef.current;
    setStarted(true);
    setHits(null);
    setVerdict(null);
    setAnalysis("");
    setError(null);
    setStreaming(true);
    onStreamingChange?.(true);

    try {
      const res = await fetch("/api/preflight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hypothesis: h }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text();
        let msg = `Pre-flight failed (HTTP ${res.status})`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) msg = parsed.error;
        } catch {
          // not JSON
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      for await (const ev of parseSSE(reader)) {
        if (reqIdRef.current !== reqId) return; // superseded
        if (ev.event === "precedents") {
          const payload = JSON.parse(ev.data) as { hits: SearchHit[] };
          setHits(payload.hits);
        } else if (ev.event === "verdict") {
          const payload = JSON.parse(ev.data) as Verdict;
          setVerdict(payload);
        } else if (ev.event === "analysis") {
          const payload = JSON.parse(ev.data) as { delta: string };
          setAnalysis((prev) => prev + payload.delta);
        } else if (ev.event === "error") {
          const payload = JSON.parse(ev.data) as { message: string };
          setError(payload.message);
        } else if (ev.event === "done") {
          // stream closed cleanly
        }
      }
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (reqIdRef.current === reqId) {
        setStreaming(false);
        onStreamingChange?.(false);
      }
    }
  }, [onStreamingChange]);

  useImperativeHandle(
    ref,
    () => ({
      run: (h: string) => {
        void runPreflight(h);
      },
    }),
    [runPreflight],
  );

  if (!started) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict slot — empty shimmer while we wait for the tool call */}
      <section aria-label="Verdict">
        {verdict === null ? (
          <div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5"
            aria-busy={streaming}
          >
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-border)]" />
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
                Awaiting verdict…
              </span>
            </div>
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-[var(--color-border)]" />
          </div>
        ) : (
          <div
            className={`rounded-lg border p-5 ${RISK_STYLES[verdict.risk_level]}`}
            role="status"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${RISK_DOT[verdict.risk_level]}`}
              />
              <span className="font-mono text-xs uppercase tracking-widest opacity-90">
                {RISK_LABEL[verdict.risk_level]}
              </span>
              {verdict.pattern_name && (
                <span className="rounded border border-current/30 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wider opacity-90">
                  {verdict.pattern_name}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-6">{verdict.risk_summary}</p>
          </div>
        )}
      </section>

      {/* Analysis prose */}
      {(verdict !== null || analysis.length > 0) && (
        <section
          aria-label="Analysis"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            Analysis
          </p>
          {analysis.length === 0 && streaming ? (
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-3 w-full animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--color-border)]" />
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--color-fg)]">
              {renderWithCitations(analysis)}
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 -translate-y-px animate-pulse bg-[var(--color-accent)] align-middle" />
              )}
            </p>
          )}
        </section>
      )}

      {/* Error (never revokes verdict; appends below) */}
      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {/* Precedents */}
      {hits !== null && hits.length > 0 && (
        <section aria-label="Precedents" className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            {hits.length} precedent{hits.length === 1 ? "" : "s"}
          </p>
          {hits.map((hit) => (
            <ExperimentCard key={hit.id} hit={hit} />
          ))}
        </section>
      )}

      {hits !== null && hits.length === 0 && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          No precedents found — verdict above reflects an empty corpus match.
        </p>
      )}
    </div>
  );
});

export default PreflightResult;
