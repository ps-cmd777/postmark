import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const experiments = (
    db.prepare("SELECT COUNT(*) AS n FROM experiments").get() as { n: number }
  ).n;
  const lessons = (
    db.prepare("SELECT COUNT(*) AS n FROM lessons").get() as { n: number }
  ).n;

  return NextResponse.json({
    status: "ok",
    phase: 2,
    experiments,
    lessons,
  });
}
