import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <BottomNav />
    </>
  );
}
