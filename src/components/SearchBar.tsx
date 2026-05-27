"use client";

// Streaming search client. Parses the /api/search SSE stream:
//   event: results  -> initial ranked hits
//   event: summary  -> appended Haiku tokens (deltas)
//   event: done     -> end of stream
//   event: error    -> redacted error message; render as banner
//
// Errors render as red banners, not crashes. Citation chips in the
// summary (e.g. [exp_007]) are visible spans but not clickable —
// experiment detail route lands in Phase 5.

import { useCallback, useState } from "react";
import type { SearchHit } from "@/lib/search";
import ExperimentCard from "./ExperimentCard";
import ExperimentLink from "./ExperimentLink";

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

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryStreaming, setSummaryStreaming] = useState(false);

  const runSearch = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const q = query.trim();
      if (!q || loading) return;

      setLoading(true);
      setError(null);
      setHits(null);
      setSummary("");
      setSummaryStreaming(false);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
        });

        if (!res.ok || !res.body) {
          const text = await res.text();
          let msg = `Search failed (HTTP ${res.status})`;
          try {
            const parsed = JSON.parse(text) as { error?: string };
            if (parsed.error) msg = parsed.error;
          } catch {
            // not JSON — keep generic message
          }
          throw new Error(msg);
        }

        const reader = res.body.getReader();
        for await (const ev of parseSSE(reader)) {
          if (ev.event === "results") {
            const payload = JSON.parse(ev.data) as { hits: SearchHit[] };
            setHits(payload.hits);
            setSummaryStreaming(true);
          } else if (ev.event === "summary") {
            const payload = JSON.parse(ev.data) as { delta: string };
            setSummary((prev) => prev + payload.delta);
          } else if (ev.event === "error") {
            const payload = JSON.parse(ev.data) as { message: string };
            throw new Error(payload.message);
          } else if (ev.event === "done") {
            setSummaryStreaming(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
        setSummaryStreaming(false);
      }
    },
    [query, loading],
  );

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={runSearch} className="flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. have we tested anything around onboarding?"
          maxLength={500}
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          aria-label="Search past experiments"
        />
        <button
          type="submit"
          disabled={loading || query.trim().length === 0}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </div>
      )}

      {hits !== null && (
        <section
          aria-label="AI summary"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-5"
        >
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            Summary
          </p>
          {summary.length === 0 && summaryStreaming ? (
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-3 w-full animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--color-border)]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--color-fg)]">
              <ExperimentLink text={summary} />
              {summaryStreaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 -translate-y-px animate-pulse bg-[var(--color-accent)] align-middle" />
              )}
            </p>
          )}
        </section>
      )}

      {hits !== null && hits.length > 0 && (
        <section aria-label="Ranked results" className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-fg-muted)]">
            {hits.length} {hits.length === 1 ? "match" : "matches"}
          </p>
          {hits.map((hit) => (
            <ExperimentCard key={hit.id} hit={hit} />
          ))}
        </section>
      )}

      {hits !== null && hits.length === 0 && !error && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          No matches. Try a broader phrasing.
        </p>
      )}
    </div>
  );
}
