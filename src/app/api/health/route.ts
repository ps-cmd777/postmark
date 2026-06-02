import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  HEALTH_LIMIT,
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = checkRateLimit(req, HEALTH_LIMIT);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSec);

  const db = getDb();
  const experiments = (
    db.prepare("SELECT COUNT(*) AS n FROM experiments").get() as { n: number }
  ).n;
  const lessons = (
    db.prepare("SELECT COUNT(*) AS n FROM lessons").get() as { n: number }
  ).n;
  const embeddingsCovered = (
    db.prepare("SELECT COUNT(*) AS n FROM vec_experiments").get() as { n: number }
  ).n;

  return NextResponse.json({
    status: "ok",
    experiments,
    lessons,
    embeddings: {
      covered: embeddingsCovered,
      total: experiments,
    },
  });
}
