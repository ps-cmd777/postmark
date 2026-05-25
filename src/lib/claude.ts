// Anthropic client wrapper. Phase 3 uses Haiku for the streaming
// search-summary synthesis. Brief §6 mandates Haiku for routine tasks,
// Opus for heavier synthesis. Search summaries are routine.
//
// The system prompt is wrapped in a cache_control: ephemeral block so
// repeated searches in a session reuse the prefix. Temperature is 0 so
// the same query + same retrieved set produces the same summary —
// makes the demo predictable for an interview.

import Anthropic from "@anthropic-ai/sdk";
import { redactSecrets } from "@/lib/redact";

export { redactSecrets };

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 600;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set — see .env.example");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

const SEARCH_SYSTEM = `You are Postmark's search summarizer. You receive a user's natural-language query and a list of past A/B experiments (with id, title, decision, lift, and what_we_learned). Write 2-4 short sentences that synthesize what the corpus says about the query.

Rules:
- Cite specific experiments by id in square brackets, e.g. [exp_007]. Cite at least the top 2 results.
- Be direct and concrete. Mention numbers (lift, p-values) when they matter.
- If the corpus says little, say so. Do not invent results.
- No bullet lists. No headers. Plain prose only.
- No emojis.`;

export interface SearchHitForPrompt {
  id: string;
  title: string;
  decision: string | null;
  lift_percent: number | null;
  what_we_learned: string;
}

export async function* streamSearchSummary(
  query: string,
  hits: SearchHitForPrompt[],
): AsyncGenerator<string, void, unknown> {
  const client = getClient();

  const corpus = hits
    .map((h) => {
      const lift =
        h.lift_percent === null
          ? "n/a"
          : `${h.lift_percent >= 0 ? "+" : ""}${h.lift_percent}%`;
      const decision = h.decision ?? "n/a";
      return `[${h.id}] ${h.title}\n  decision=${decision}  lift=${lift}\n  learned: ${h.what_we_learned}`;
    })
    .join("\n\n");

  const userMessage = `Query: ${query}\n\nTop matches:\n${corpus}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SEARCH_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Claude summary failed: ${redactSecrets(raw)}`);
  }
}
