import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const unauth = requireApiKey(req);
  if (unauth) return unauth;
  const body = await req.json().catch(()=>({}));
  let terminalId = String(body.terminalId || "");
  let amount = typeof body.amount === "number" ? Math.trunc(body.amount) : undefined;
  let currency = String(body.currency || "");

  if (!terminalId) return NextResponse.json({ error: "terminalId required" }, { status: 400 });
  if (amount === undefined) amount = getEnv().DEFAULT_AMOUNT;
  if (!currency) currency = getEnv().DEFAULT_CURRENCY;

  const s = await prisma.session.create({ data: { terminalId, amount, currency, status: "pending" } });
  return NextResponse.json(s, { status: 201 });
}
