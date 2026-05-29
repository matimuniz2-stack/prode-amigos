import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { TopNav } from "@/components/top-nav";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNav />
      <AppShell>{children}</AppShell>
      <BottomNav />
    </>
  );
}
