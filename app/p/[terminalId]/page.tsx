import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function getNewestPending(terminalId: string){
  return prisma.session.findFirst({
    where: { terminalId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

async function getPending(terminalId: string){
  return prisma.session.findMany({
    where: { terminalId, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export default async function Page({ params }: { params: { terminalId: string } }) {
  const { terminalId } = params;
  const session = await getNewestPending(terminalId);
  const isAdmin = isAdminAuthed();

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold">Checkout — {terminalId}</h1>
        {session ? (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-gray-500">Session</div><div className="font-mono break-all">{session.id}</div></div>
              <div><div className="text-gray-500">Status</div><span className="badge">{session.status}</span></div>
              <div><div className="text-gray-500">Amount</div><div>{session.amount} {session.currency}</div></div>
              <div><div className="text-gray-500">Created</div><div>{session.createdAt.toISOString()}</div></div>
            </div>
            <form method="post" action="/api/sandbox/pay" className="mt-3">
              <input type="hidden" name="sessionId" value={session.id} />
              <button className="btn w-full">Approve (Sandbox)</button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mt-2">No pending session for this terminal.</p>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Operator Tools</h2>
        <p className="text-sm text-gray-600">Generate a new payment for this terminal.</p>
        <form method="post" action="/api/admin/sessions/create" className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-3">
          <input name="terminalId" defaultValue={terminalId} className="border rounded-lg px-3 py-2 md:col-span-2" />
          <input name="amount" placeholder="Amount (e.g. 0 or 500)" className="border rounded-lg px-3 py-2 md:col-span-1" />
          <input name="currency" placeholder="USD" className="border rounded-lg px-3 py-2 md:col-span-1" />
          <button className="btn md:col-span-1" type="submit">Generate Payment</button>
        </form>
        <p className="text-xs text-gray-500 mt-2">Leave amount empty to use the default for the device/store.</p>
      </div>

      {isAdmin && <PendingManager terminalId={terminalId} />}
    </div>
  );
}

async function PendingManager({ terminalId }: { terminalId: string }) {
  const rows = await getPending(terminalId);
  if (!rows.length) return (
    <div className="card"><h2 className="text-lg font-semibold">Pending Session Manager</h2><p className="text-sm text-gray-500 mt-2">No pending sessions.</p></div>
  );

  const newestId = rows[0].id;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold">Pending Session Manager</h2>
      <p className="text-sm text-gray-600">Only the most recent pending can be approved. Cancel older ones here.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr><th className="text-left p-2">ID</th><th className="text-left p-2">Created</th><th className="text-left p-2">Actions</th></tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2 font-mono break-all">{r.id}</td>
                <td className="p-2">{r.createdAt.toISOString()}</td>
                <td className="p-2">
                  {r.id === newestId ? <span className="badge">Newest</span> : (
                    <form method="post" action="/api/admin/sessions/cancel">
                      <input type="hidden" name="sessionId" value={r.id} />
                      <input type="hidden" name="terminalId" value={terminalId} />
                      <button className="btn-outline">Cancel</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form method="post" action="/api/admin/sessions/cancel-older" className="mt-3">
        <input type="hidden" name="terminalId" value={terminalId} />
        <button className="btn-outline">Cancel All Older Pending</button>
      </form>
    </div>
  );
}
