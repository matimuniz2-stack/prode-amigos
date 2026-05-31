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
    // count y getClaims son independientes → en paralelo.
    const [countRes, { data: claims }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.auth.getClaims(),
    ]);
    playerCount = countRes.count ?? 0;

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
