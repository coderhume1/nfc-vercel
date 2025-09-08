import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await prisma.session.findUnique({ where: { id: params.id } });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(s);
}
