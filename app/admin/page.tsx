import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import Section from "@/components/Section";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Admin() {
  if (!isAdminAuthed()) {
    return (
      <div className="max-w-sm mx-auto card">
        <h1 className="text-xl font-semibold mb-4">Admin Login</h1>
        <form method="post" action="/api/admin/login" className="space-y-3">
          <input name="key" placeholder="Admin key" className="w-full border rounded-lg px-3 py-2" />
          <button type="submit" className="btn w-full">Login</button>
        </form>
      </div>
    );
  }
  const sessions = await prisma.session.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <>
      <Section title="Admin" actions={<Link className="btn" href="/admin/devices">Manage Devices</Link>}>
        <form method="post" action="/api/admin/sessions/create" className="grid md:grid-cols-6 gap-2 mb-4">
  <input name="terminalId" placeholder="Terminal ID (e.g. STORE01-0001)" required className="border rounded-lg px-3 py-2 md:col-span-2" />
  <input name="amount" placeholder="Amount (e.g. 0 or 500)" className="border rounded-lg px-3 py-2" />
  <input name="currency" placeholder="USD" className="border rounded-lg px-3 py-2" />
  <div className="md:col-span-2 self-center text-xs text-gray-500">Leave amount empty to use default</div>
  <button className="btn md:col-span-1" type="submit">Generate Payment</button>
</form>

        <p className="text-sm text-gray-600">Recent sessions</p>
        <div className="overflow-x-auto mt-3">
          <table className="table">
            <thead><tr><th>id</th><th>terminal</th><th>amt</th><th>ccy</th><th>status</th><th>created</th></tr></thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-xs">{s.id}</td>
                  <td>{s.terminalId}</td>
                  <td>{s.amount}</td>
                  <td>{s.currency}</td>
                  <td>{s.status === "paid" ? <span className="badge badge-paid">paid</span> : <span className="badge badge-pending">pending</span>}</td>
                  <td className="text-xs">{s.createdAt.toISOString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
