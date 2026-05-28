// Postmark MCP server. Stdio transport, four read tools, all thin
// wrappers around the existing src/lib functions. Run via:
//   npm run mcp           — raw stdio (for Claude Desktop spawning)
//   npm run mcp:inspect   — opens the MCP inspector UI for manual testing
//
// Stdout is the JSON-RPC channel for stdio transport — only the SDK
// may write to it. All diagnostic logs in this file go to console.error
// (stderr is safe). The reused src/lib code uses console.warn for
// defensive logging, which Node also writes to stderr.
//
// Deviation from POSTMARK_PROJECT_BRIEF.md §6/§9: the brief specified
// Python + FastMCP. Switched to TypeScript + the official MCP SDK
// because the corpus retrieval / DB / pattern logic is all TS in
// src/lib — a TS MCP server imports those directly instead of
// reimplementing in Python. One language, no sidecar, full reuse.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { semanticSearch } from "@/lib/search";
import { runPreflightVerdict } from "@/lib/preflight";
import { getExperimentById } from "@/lib/experiments";
import { PATTERNS } from "@/lib/patterns";

const SERVER_NAME = "postmark";
const SERVER_VERSION = "0.0.1";
const SNIPPET_CHARS = 280;

function jsonText(obj: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(obj, null, 2) },
    ],
  };
}

function errorText(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function snippet(text: string): string {
  if (text.length <= SNIPPET_CHARS) return text;
  return `${text.slice(0, SNIPPET_CHARS).trimEnd()}…`;
}

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

// ---------- Tool 1: search_experiments ----------

server.registerTool(
  "search_experiments",
  {
    description:
      "Semantic search over the 50-experiment Pixmate corpus. Returns the top ranked past experiments for a natural-language query (e.g. 'have we tested onboarding gates?').",
    inputSchema: {
      query: z
        .string()
        .min(3)
        .max(500)
        .describe("Natural-language search query."),
    },
  },
  async ({ query }) => {
    try {
      const hits = await semanticSearch(query);
      return jsonText({
        hits: hits.map((h) => ({
          id: h.id,
          title: h.title,
          decision: h.decision,
          lift_percent: h.lift_percent,
          similarity: Number(h.similarity.toFixed(3)),
          what_we_learned_snippet: snippet(h.what_we_learned),
        })),
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      return errorText(`search_experiments failed: ${raw}`);
    }
  },
);

// ---------- Tool 2: preflight_check ----------

server.registerTool(
  "preflight_check",
  {
    description:
      "Pre-flight risk verdict for a proposed experiment hypothesis. Retrieves structurally similar past experiments and returns a structured verdict (risk_level, risk_summary, pattern_name) plus the precedent experiment IDs the verdict cites.",
    inputSchema: {
      hypothesis: z
        .string()
        .min(20)
        .max(2000)
        .describe(
          "The proposed experiment hypothesis — a sentence or short paragraph describing what would be tested and what outcome is expected.",
        ),
    },
  },
  async ({ hypothesis }) => {
    const result = await runPreflightVerdict(hypothesis);
    if (!result.ok) {
      return errorText(`preflight_check failed: ${result.error}`);
    }
    return jsonText({
      verdict: result.verdict,
      precedent_ids: result.hits.map((h) => h.id),
    });
  },
);

// ---------- Tool 3: get_experiment ----------

server.registerTool(
  "get_experiment",
  {
    description:
      "Fetch the full record for a single experiment by ID (e.g. 'exp_027'). Returns all fields except the embedding vector.",
    inputSchema: {
      id: z
        .string()
        .regex(/^exp_\d{3,4}$/)
        .describe("Experiment ID in the form 'exp_NNN'."),
    },
  },
  async ({ id }) => {
    const exp = getExperimentById(id);
    if (!exp) return errorText(`Experiment ${id} not found.`);
    return jsonText(exp);
  },
);

// ---------- Tool 4: list_patterns ----------

server.registerTool(
  "list_patterns",
  {
    description:
      "List the 12 hand-curated cross-experiment patterns. Optionally filter by strength.",
    inputSchema: {
      strength: z
        .enum(["hardened", "emerging", "single_instance"])
        .optional()
        .describe("Restrict to patterns with this strength."),
    },
  },
  async ({ strength }) => {
    const filtered = strength
      ? PATTERNS.filter((p) => p.strength === strength)
      : PATTERNS;
    return jsonText({
      patterns: filtered.map((p) => ({
        id: p.id,
        name: p.name,
        strength: p.strength,
        description: p.description,
        member_experiment_ids: p.member_experiment_ids,
      })),
    });
  },
);

// ---------- Boot ----------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[postmark-mcp] ${SERVER_NAME}@${SERVER_VERSION} listening on stdio`,
  );
}

main().catch((err) => {
  console.error("[postmark-mcp] fatal:", err);
  process.exit(1);
});
