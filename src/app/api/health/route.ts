import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// No rate limit here on purpose. Render's load balancer pings this
// on a tight schedule; a 429 from infrastructure-driven traffic
// looks like an outage and triggers false-positive alerts. The
// endpoint has no AI cost (static JSON over a SQLite count) so it's
// not a cost-runaway risk. Rate limiting stays on /api/preflight
// and /api/search where it matters.

export const dynamic = "force-dynamic";

export async function GET() {
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
