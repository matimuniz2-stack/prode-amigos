"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BookOpen,
  ClipboardList,
  Home,
  Radio,
  Search,
  Shield,
  Trophy,
  User,
} from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

/** Navegación lateral — solo en desktop (lg+). En mobile/tablet se usa BottomNav. */
export function Sidebar({
  playerCount,
  isAdmin,
}: {
  playerCount: number;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: "Inicio", icon: Home },
    { href: "/matches", label: "Pronósticos", icon: ClipboardList },
    { href: "/leaderboard", label: "Ranking", icon: Trophy },
    { href: "/sala-en-vivo", label: "En vivo", icon: Radio },
    { href: "/globales", label: "Globales", icon: Award },
    { href: "/reglas", label: "Reglas", icon: BookOpen },
    { href: "/mi-prode", label: "Perfil", icon: User },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-svh w-60 flex-col gap-3 border-r border-cream/10 bg-pitch-deep/85 p-4 backdrop-blur lg:flex">
      <Link href="/dashboard" className="mb-1 flex items-center gap-2 px-2 py-1">
        <span aria-hidden className="text-2xl leading-none">
          ⚽
        </span>
        <span className="text-display text-2xl leading-none text-cream">
          PRODE
        </span>
      </Link>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-palette"))}
        className="mb-1 flex items-center gap-2 rounded-xl border border-cream/15 bg-black/20 px-3 py-2 text-sm font-semibold text-cream/60 transition-colors hover:text-cream"
      >
        <Search className="size-4" />
        Buscar
        <span className="ml-auto rounded-md bg-cream/10 px-1.5 py-0.5 text-[10px] font-bold">
          ⌘K
        </span>
      </button>

      <nav className="flex flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                active
                  ? "bg-gold text-ink"
                  : "text-cream/70 hover:bg-cream/10 hover:text-cream",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-2xl bg-black/20 p-3 text-center ring-1 ring-cream/10">
          <div className="text-[10px] font-bold uppercase tracking-wide text-gold">
            🏆 Liga activa
          </div>
          <div className="text-sm font-extrabold text-cream">
            Prode de los Pibes
          </div>
          <div className="text-xs text-cream/60">
            {playerCount} jugador{playerCount === 1 ? "" : "es"}
          </div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
