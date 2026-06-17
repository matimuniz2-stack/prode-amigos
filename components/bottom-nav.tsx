"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const LEFT = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/leaderboard", label: "Ranking", icon: Trophy },
];
const RIGHT = [
  { href: "/sala-en-vivo", label: "En vivo", icon: Radio },
  { href: "/mi-prode", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const itemCls = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors",
      active ? "text-grass" : "text-ink/50 hover:text-ink active:scale-95",
    );
  const cargarActive = pathname.startsWith("/matches");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-auto max-w-[480px]">
        <div className="flex items-stretch justify-around rounded-t-[1.75rem] bg-cream px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.5)]">
          {LEFT.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={itemCls(active)}>
                <Icon className={cn("size-[22px]", active && "stroke-[2.5]")} />
                {label}
              </Link>
            );
          })}

          {/* FAB central elevado: cargar pronósticos */}
          <Link
            href="/matches"
            className="flex flex-1 flex-col items-center"
            aria-label="Cargar pronósticos"
          >
            <span
              className={cn(
                "-mt-7 grid size-14 place-items-center rounded-full text-2xl shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-4 ring-cream transition active:scale-95",
                cargarActive ? "bg-gold" : "bg-pitch",
              )}
            >
              ⚽
            </span>
            <span
              className={cn(
                "mt-0.5 text-[11px] font-bold",
                cargarActive ? "text-grass" : "text-ink/60",
              )}
            >
              Cargar
            </span>
          </Link>

          {RIGHT.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={itemCls(active)}>
                <Icon className={cn("size-[22px]", active && "stroke-[2.5]")} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
