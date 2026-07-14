import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "THM Dashboard — TryHackMe Profile Monitor",
    template: "%s · THM Dashboard",
  },
  description:
    "A clean, gamified dashboard for viewing any public TryHackMe student profile.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <div className="app-backdrop min-h-screen">
          <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-accent/15 text-accent ring-1 ring-inset ring-accent/30">
                <span className="text-sm font-bold">T</span>
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-200">
                THM Dashboard
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-lg px-3 py-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
              >
                Home
              </Link>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-6 pb-24">{children}</main>
        </div>
      </body>
    </html>
  );
}
