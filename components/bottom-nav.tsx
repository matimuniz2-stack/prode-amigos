"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Radio, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home, soon: false },
  { href: "/matches", label: "Prode", icon: ClipboardList, soon: false },
  { href: "/leaderboard", label: "Ranking", icon: Trophy, soon: false },
  { href: "/sala-en-vivo", label: "En vivo", icon: Radio, soon: false },
  { href: "/mi-prode", label: "Perfil", icon: User, soon: false },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="mx-auto max-w-[480px]">
        <div className="flex items-stretch justify-around rounded-t-[1.75rem] bg-cream px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.5)]">
          {ITEMS.map(({ href, label, icon: Icon, soon }) => {
            const active = !soon && pathname === href;
            const inner = (
              <>
                <Icon className={cn("size-[22px]", active && "stroke-[2.5]")} />
                {label}
              </>
            );
            const cls = cn(
              "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors",
              soon
                ? "text-ink/30"
                : active
                  ? "text-grass"
                  : "text-ink/50 hover:text-ink active:scale-95",
            );
            if (soon) {
              return (
                <span key={label} aria-disabled title="Pronto" className={cls}>
                  {inner}
                </span>
              );
            }
            return (
              <Link key={label} href={href} className={cls}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
