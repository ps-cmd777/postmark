// Voyage AI embedding generator. One batched call for the entire
// experiment corpus. No auto-retry — if Voyage fails, surface clearly
// and let the user rerun seed.

import { VoyageAIClient } from "voyageai";
import type { Experiment } from "@/types";
import { redactSecrets } from "@/lib/redact";

export { redactSecrets };

const MODEL = "voyage-3-large";
const DIMENSIONS = 1024;
const INPUT_TYPE = "document";

let _client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (_client) return _client;
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY not set — see .env.example");
  }
  _client = new VoyageAIClient({ apiKey });
  return _client;
}

function buildEmbeddingText(exp: Experiment): string {
  return [
    exp.title,
    exp.hypothesis,
    exp.what_we_learned,
    `Tags: ${exp.tags.join(", ")}`,
  ].join("\n");
}

export async function generateEmbeddings(
  experiments: Experiment[],
): Promise<Map<string, number[]>> {
  if (experiments.length === 0) {
    return new Map();
  }

  const client = getClient();
  const inputs = experiments.map(buildEmbeddingText);

  let response;
  try {
    response = await client.embed({
      input: inputs,
      model: MODEL,
      inputType: INPUT_TYPE,
      outputDimension: DIMENSIONS,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Voyage embedding generation failed: ${redactSecrets(raw)}`);
  }

  const data = response.data;
  if (!data || data.length !== experiments.length) {
    throw new Error(
      `Voyage returned ${data?.length ?? 0} embeddings for ${experiments.length} inputs`,
    );
  }

  const result = new Map<string, number[]>();
  for (let i = 0; i < experiments.length; i++) {
    const item = data[i];
    const vec = item?.embedding;
    if (!vec || vec.length !== DIMENSIONS) {
      throw new Error(
        `Voyage embedding for ${experiments[i].id} has unexpected shape: ${vec?.length ?? "missing"} dims (expected ${DIMENSIONS})`,
      );
    }
    result.set(experiments[i].id, vec);
  }

  return result;
}
