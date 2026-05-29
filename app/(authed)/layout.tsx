import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

const NAV_LINKS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/matches", label: "Partidos" },
  { href: "/mi-prode", label: "Mi prode" },
];

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-svh flex flex-col">
      <nav className="w-full border-b border-foreground/10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-4 p-3 px-5">
          <Link href="/dashboard" className="font-semibold text-sm">
            PRODE LOS PIBES
          </Link>
          <div className="flex items-center gap-3 text-sm flex-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Suspense fallback={null}>
            <AuthButton />
          </Suspense>
        </div>
      </nav>
      <div className="flex-1 max-w-5xl w-full mx-auto p-5">{children}</div>
      <footer className="w-full border-t text-xs flex items-center justify-center gap-4 py-4 text-muted-foreground">
        <span>PRODE LOS PIBES · 2026</span>
        <ThemeSwitcher />
      </footer>
    </main>
  );
}
