import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "NFC Pay Starter (Vercel)",
  description: "Next.js + Prisma + Neon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="nav-inner">
            <Link href="/" className="brand">NFC Pay</Link>
            <div className="flex items-center gap-3">
              <Link className="btn-outline" href="/admin">Admin</Link>
              <a className="btn-outline" href="/p/ADMIN_TEST">Checkout Demo</a>
            </div>
          </div>
        </nav>
        <main className="container py-6">{children}</main>
        <footer className="container py-10 text-sm text-gray-500">
          Built for demos. Do not use in production without security hardening.
        </footer>
      </body>
    </html>
  );
}
