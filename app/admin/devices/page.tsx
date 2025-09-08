import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";
import Section from "@/components/Section";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DevicesPage() {
  if (!isAdminAuthed()) {
    return <main><div className="max-w-sm mx-auto card"><h1 className="text-xl font-semibold">Unauthorized</h1></div></main>;
  }
  const devices = await prisma.device.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <Section title="Devices">
        <form method="post" action="/api/admin/devices/upsert" className="grid md:grid-cols-6 gap-2 mb-4">
          <input name="deviceId" placeholder="deviceId (hex)" required className="border rounded-lg px-3 py-2 md:col-span-2" />
          <input name="storeCode" placeholder="STORE01" className="border rounded-lg px-3 py-2" />
          <input name="terminalId" placeholder="(auto if empty)" className="border rounded-lg px-3 py-2" />
          <input name="amount" placeholder="0" className="border rounded-lg px-3 py-2" />
          <input name="currency" placeholder="USD" className="border rounded-lg px-3 py-2" />
          <button className="btn md:col-span-1" type="submit">Upsert</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>deviceId</th><th>store</th><th>terminal</th><th>amount</th><th>ccy</th><th>status</th><th>created</th><th></th></tr></thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.deviceId}>
                  <td className="font-mono text-xs">{d.deviceId}</td>
                  <td>{d.storeCode}</td>
                  <td>{d.terminalId}</td>
                  <td>{d.amount}</td>
                  <td>{d.currency}</td>
                  <td><span className={d.status === "new" ? "badge badge-new" : "badge badge-paid"}>{d.status}</span></td>
                  <td className="text-xs">{d.createdAt.toISOString()}</td>
                  <td>
                    <form method="post" action="/api/admin/devices/delete">
                      <input type="hidden" name="deviceId" value={d.deviceId} />
                      <button className="btn-outline text-red-600">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
