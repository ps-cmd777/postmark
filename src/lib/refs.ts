// Cross-reference validator. Scans hypothesis + what_we_learned prose
// for /exp_\d{3}/ patterns and verifies each match resolves to an ID
// in the corpus. Tags, titles, and segment strings are NOT scanned —
// those are not first-class data references.

import type { Experiment } from "@/types";

const EXP_REF_PATTERN = /exp_\d{3}/g;
const SNIPPET_RADIUS = 40; // characters on either side of the match

export interface BrokenRef {
  sourceExperimentId: string;
  referencedId: string;
  field: "hypothesis" | "what_we_learned";
  contextSnippet: string;
}

export interface CrossRefResult {
  valid: boolean;
  brokenRefs: BrokenRef[];
}

export function validateCrossReferences(experiments: Experiment[]): CrossRefResult {
  const knownIds = new Set(experiments.map((e) => e.id));
  const broken: BrokenRef[] = [];

  for (const exp of experiments) {
    for (const field of ["hypothesis", "what_we_learned"] as const) {
      const prose = exp[field];
      for (const match of prose.matchAll(EXP_REF_PATTERN)) {
        const ref = match[0];
        if (ref === exp.id) continue; // self-reference is fine
        if (knownIds.has(ref)) continue;

        const idx = match.index ?? 0;
        const start = Math.max(0, idx - SNIPPET_RADIUS);
        const end = Math.min(prose.length, idx + ref.length + SNIPPET_RADIUS);
        const snippet = prose.slice(start, end).replace(/\s+/g, " ").trim();

        broken.push({
          sourceExperimentId: exp.id,
          referencedId: ref,
          field,
          contextSnippet: `${start > 0 ? "..." : ""}${snippet}${end < prose.length ? "..." : ""}`,
        });
      }
    }
  }

  return { valid: broken.length === 0, brokenRefs: broken };
}
