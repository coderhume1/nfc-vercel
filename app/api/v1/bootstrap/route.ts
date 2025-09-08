import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { nextTerminalForStore } from "@/lib/terminals";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const unauth = requireApiKey(req);
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const qDevice = (searchParams.get("deviceId") || "").trim();
  const headerDevice = req.headers.get("x-device-id") || "";
  const deviceId = (qDevice || headerDevice || "UNKNOWN").toUpperCase();
  const storeCode = (req.headers.get("x-store-code") || searchParams.get("store") || getEnv().DEFAULT_STORE_CODE).toUpperCase();

  let dev = await prisma.device.findUnique({ where: { deviceId } });
  let autoEnrolled = false;
  if (!dev) {
    autoEnrolled = true;
    const terminalId = await nextTerminalForStore(storeCode);
    dev = await prisma.device.create({
      data: {
        deviceId,
        storeCode,
        terminalId,
        amount: getEnv().DEFAULT_AMOUNT,
        currency: getEnv().DEFAULT_CURRENCY,
        status: "active",
      },
    });
  }

  const checkoutUrl = `${getEnv().PUBLIC_BASE_URL}/p/${dev.terminalId}`;

  return NextResponse.json({
    deviceId: dev.deviceId,
    storeCode: dev.storeCode,
    terminalId: dev.terminalId,
    amount: dev.amount,
    currency: dev.currency,
    checkoutUrl,
    autoEnrolled,
  });
}
