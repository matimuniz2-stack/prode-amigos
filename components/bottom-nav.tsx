"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/matches", label: "Prode", icon: ClipboardList },
  { href: "/dashboard#ranking", label: "Ranking", icon: Trophy },
  { href: "/mi-prode", label: "Perfil", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="mx-auto max-w-[480px]">
        <div className="flex items-stretch justify-around rounded-t-[1.75rem] bg-cream px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-ink shadow-[0_-10px_30px_-12px_rgba(0,0,0,0.5)]">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const base = href.split("#")[0];
            const active = pathname === base;
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-semibold transition-colors active:scale-95",
                  active ? "text-grass" : "text-ink/50 hover:text-ink",
                )}
              >
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
