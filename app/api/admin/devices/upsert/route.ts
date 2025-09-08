import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { nextTerminalForStore } from "@/lib/terminals";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const deviceId = String(form.get("deviceId") || "").trim();
  const storeCode = String(form.get("storeCode") || "").trim() || getEnv().DEFAULT_STORE_CODE;
  let terminalId = String(form.get("terminalId") || "").trim();
  const amount = parseInt(String(form.get("amount") || ""), 10);
  const currency = String(form.get("currency") || "").trim() || getEnv().DEFAULT_CURRENCY;
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });
  if (!terminalId) terminalId = await nextTerminalForStore(storeCode);
  await prisma.device.upsert({
    where: { deviceId }, create: { deviceId, storeCode, terminalId, amount: isNaN(amount) ? getEnv().DEFAULT_AMOUNT : amount, currency, status: "active" },
    update: { storeCode, terminalId, amount: isNaN(amount) ? getEnv().DEFAULT_AMOUNT : amount, currency, status: "active" },
  });
  return NextResponse.redirect(new URL("/admin/devices", req.url));
}
