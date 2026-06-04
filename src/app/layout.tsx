import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Postmark",
  description:
    "A living memory of your team's product experiments — with AI that warns you before you repeat a mistake.",
};

const NAV = [
  { href: "/", label: "Search" },
  { href: "/preflight", label: "Pre-flight" },
  { href: "/lessons", label: "Lessons" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
        <header className="border-b border-[var(--color-border)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-tight text-[var(--color-accent)]">▣</span>
              <span className="text-sm font-semibold tracking-tight">Postmark</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-[var(--color-fg-muted)]">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-[var(--color-fg)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-[var(--color-border)] px-6 py-4 text-xs text-[var(--color-fg-muted)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <span className="font-mono">postmark</span>
            <span>seed data: synthetic (Pixmate)</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
