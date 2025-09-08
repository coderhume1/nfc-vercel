import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true });
}
