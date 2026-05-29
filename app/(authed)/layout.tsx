import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let playerCount = 0;
  let isAdmin = false;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    playerCount = count ?? 0;

    const { data: claims } = await supabase.auth.getClaims();
    if (claims?.claims) {
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", claims.claims.sub as string)
        .maybeSingle();
      isAdmin = p?.role === "admin" || p?.role === "owner";
    }
  }

  return (
    <>
      <Sidebar playerCount={playerCount} isAdmin={isAdmin} />
      <div className="lg:pl-60">
        <AppShell>{children}</AppShell>
      </div>
      <BottomNav />
    </>
  );
}
