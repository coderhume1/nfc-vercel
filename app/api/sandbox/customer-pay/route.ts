import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEMO-ONLY: Public "customer approval" endpoint.
 * Usage:
 *   GET /api/sandbox/customer-pay?sessionId=...    // approve that session if it's the newest pending for its terminal
 *   GET /api/sandbox/customer-pay?terminalId=...   // approve the newest pending for that terminal
 *
 * Security: NO AUTH. Do NOT use in production.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = String(searchParams.get("sessionId") || "");
  const terminalIdParam = String(searchParams.get("terminalId") || "");

  let target = null as null | { id: string, terminalId: string };

  if (sessionId) {
    const s = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
    target = { id: s.id, terminalId: s.terminalId };
  } else if (terminalIdParam) {
    const s = await prisma.session.findFirst({
      where: { terminalId: terminalIdParam, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
    target = { id: s.id, terminalId: s.terminalId };
  } else {
    return NextResponse.json({ error: "terminalId_or_sessionId_required" }, { status: 400 });
  }

  // Only approve newest pending for that terminal
  const newest = await prisma.session.findFirst({
    where: { terminalId: target.terminalId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  if (!newest || newest.id !== target.id) {
    return NextResponse.json({ error: "conflict", message: "Only the most recent pending session can be approved." }, { status: 409 });
  }

  await prisma.session.update({ where: { id: target.id }, data: { status: "paid" } });
  await prisma.session.updateMany({ where: { terminalId: target.terminalId, status: "pending" }, data: { status: "canceled" } });

  revalidatePath(`/p/${target.terminalId}`);
  revalidatePath(`/admin`);

  // Redirect back to checkout page
  return NextResponse.redirect(new URL(`/p/${target.terminalId}`, req.url));
}
