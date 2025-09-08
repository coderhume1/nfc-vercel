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
  const terminalId = String(form.get("terminalId") || "");
  if (!terminalId) return NextResponse.json({ error: "terminalId required" }, { status: 400 });

  const latest = await prisma.session.findFirst({
    where: { terminalId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  await prisma.session.updateMany({
    where: { terminalId, status: "pending", ...(latest ? { NOT: { id: latest.id } } : {}) },
    data: { status: "canceled" },
  });

  return NextResponse.redirect(new URL(`/p/${terminalId}`, req.url));
}
