import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-svh flex flex-col">
      <nav className="w-full border-b border-foreground/10">
        <div className="max-w-5xl mx-auto flex justify-between items-center p-3 px-5">
          <Link href="/dashboard" className="font-semibold text-sm">
            PRODE LOS PIBES
          </Link>
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
