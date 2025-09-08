import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey, isAdminAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authed = isAdminAuthed() || !requireApiKey(req);
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") || "";
  let sessionId = "";
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    sessionId = String(body.sessionId || "");
  } else {
    const form = await req.formData();
    sessionId = String(form.get("sessionId") || "");
  }
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const s = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Only latest pending for the terminal can be approved
  const latest = await prisma.session.findFirst({
    where: { terminalId: s.terminalId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  if (!latest || latest.id !== s.id) {
    return NextResponse.json({ error: "conflict", message: "Only the most recent pending session can be approved. Cancel older ones first." }, { status: 409 });
  }

  await prisma.session.update({ where: { id: s.id }, data: { status: "paid" } });
  await prisma.session.updateMany({
    where: { terminalId: s.terminalId, status: "pending" },
    data: { status: "canceled" },
  });

  return NextResponse.redirect(new URL(`/p/${s.terminalId}`, req.url));
}
