import { cookies } from "next/headers";
import { getEnv } from "./env";

export function requireApiKey(req: Request) {
  const { API_KEY } = getEnv();
  const key = req.headers.get("x-api-key");
  if (!key || key !== API_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return null;
}

export function isAdminAuthed() {
  const ck = cookies();
  return ck.get("admin")?.value === "1";
}

export function adminLoginOk(key: string) {
  const { ADMIN_KEY } = getEnv();
  return key === ADMIN_KEY;
}
