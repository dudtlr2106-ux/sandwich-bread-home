import { NextResponse } from "next/server";
import { readLogs } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(requested) ? requested : 100;
  return NextResponse.json({ logs: readLogs(limit) });
}
