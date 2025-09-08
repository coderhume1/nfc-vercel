import { NextRequest, NextResponse } from "next/server";
import { adminLoginOk } from "@/lib/auth";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const key = String(form.get("key") || "");
  if (!adminLoginOk(key)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const res = NextResponse.redirect(new URL("/admin", req.url));
  res.cookies.set("admin", "1", { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
