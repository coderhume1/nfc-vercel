import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/auth";
import { getEnv } from "@/lib/env";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const unauth = requireApiKey(req);
  if (unauth) return unauth;
  const body = await req.json().catch(()=>({}));
  const deviceId = req.headers.get("x-device-id") || "";
  let terminalId = String(body.terminalId || "");
  let amount = typeof body.amount === "number" ? Math.trunc(body.amount) : undefined;
  let currency = String(body.currency || "");

  if (!terminalId && deviceId) {
    const dev = await prisma.device.findUnique({ where: { deviceId: deviceId.toUpperCase() } });
    if (dev) {
      terminalId = dev.terminalId;
      if (amount === undefined) amount = dev.amount;
      if (!currency) currency = dev.currency;
    }
  }
  if (!terminalId) return NextResponse.json({ error: "terminalId required" }, { status: 400 });
  if (amount === undefined) amount = getEnv().DEFAULT_AMOUNT;
  if (!currency) currency = getEnv().DEFAULT_CURRENCY;

  const s = await prisma.session.create({ data: { terminalId, amount, currency, status: "pending" } });
  return NextResponse.json(s, { status: 201 });
}

export async function GET(_req: NextRequest) {
  const rows = await prisma.session.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(rows);
}
