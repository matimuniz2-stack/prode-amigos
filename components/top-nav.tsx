"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/matches", label: "Prode" },
  { href: "/leaderboard", label: "Ranking" },
  { href: "/globales", label: "Globales" },
  { href: "/mi-prode", label: "Perfil" },
];

/** Navegación superior — solo en desktop (md+). En mobile se usa BottomNav. */
export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-cream/10 bg-pitch-deep/85 backdrop-blur md:block">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/dashboard"
          className="text-display text-xl leading-none text-cream"
        >
          PRODE <span className="text-gold">DE LOS PIBES</span>
        </Link>
        <nav className="flex items-center gap-1">
          {ITEMS.map((i) => {
            const active = pathname === i.href;
            return (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                  active
                    ? "bg-gold text-ink"
                    : "text-cream/70 hover:bg-cream/10 hover:text-cream",
                )}
              >
                {i.label}
              </Link>
            );
          })}
          <span className="ml-1">
            <LogoutButton />
          </span>
        </nav>
      </div>
    </header>
  );
}
