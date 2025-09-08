import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ck = cookies();
  if (ck.get("admin")?.value !== "1") {
    // redirect to admin login if not authenticated
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  const form = await req.formData();
  const terminalId = String(form.get("terminalId") || "").trim();
  const amountStr = String(form.get("amount") || "").trim();
  const currency = String(form.get("currency") || "").trim() || getEnv().DEFAULT_CURRENCY;

  const amount = amountStr === "" ? getEnv().DEFAULT_AMOUNT : Math.trunc(Number(amountStr));
  if (!terminalId) return NextResponse.json({ error: "terminalId required" }, { status: 400 });

  const s = await prisma.session.create({
    data: { terminalId, amount: isNaN(amount) ? getEnv().DEFAULT_AMOUNT : amount, currency, status: "pending" },
  });
  return NextResponse.redirect(new URL(`/p/${s.terminalId}`, req.url));
}
