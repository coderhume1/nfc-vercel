import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ck = cookies();
  if (ck.get("admin")?.value !== "1") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  const form = await req.formData();
  const sessionId = String(form.get("sessionId") || "");
  const terminalId = String(form.get("terminalId") || "");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  await prisma.session.update({ where: { id: sessionId }, data: { status: "canceled" } }).catch(() => {});
  const back = terminalId ? `/p/${terminalId}` : "/admin";
  return NextResponse.redirect(new URL(back, req.url));
}
