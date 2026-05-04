import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    phase: 1,
    experiments: 0,
    lessons: 0,
  });
}
