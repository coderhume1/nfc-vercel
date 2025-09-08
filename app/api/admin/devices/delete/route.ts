import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const deviceId = String(form.get("deviceId") || "");
  await prisma.device.delete({ where: { deviceId } }).catch(()=>{});
  return NextResponse.redirect(new URL("/admin/devices", req.url));
}
