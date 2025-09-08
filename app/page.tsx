import Link from "next/link";

export default function Home() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-2">NFC Pay Starter (Vercel)</h1>
        <p className="text-gray-600">
          Minimal backend + admin UI for NFC checkout flows using Next.js, Prisma & Neon.
        </p>
        <div className="mt-4 flex gap-3">
          <Link href="/admin" className="btn">Open Admin</Link>
          <Link href="/p/ADMIN_TEST" className="btn-outline">Try Checkout Demo</Link>
        </div>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold mb-2">Quick Links</h2>
        <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
          <li><code>/api/v1/bootstrap</code> — auto-enroll devices</li>
          <li><code>/api/v1/sessions</code> — create session</li>
          <li><code>/api/sandbox/pay</code> — mark paid</li>
          <li><code>/p/&lt;terminalId&gt;</code> — checkout page</li>
        </ul>
      </div>
    </div>
  );
}
