import { AppShell } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";
import { ArgentinaMode } from "@/components/argentina-mode";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getArgentinaMatch } from "@/lib/argentina";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let playerCount = 0;
  let isAdmin = false;
  let argMode = false;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    // count, getClaims y el partido de Argentina son independientes → en paralelo.
    const [countRes, { data: claims }, argMatch] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.auth.getClaims(),
      getArgentinaMatch(supabase, Date.now()),
    ]);
    playerCount = countRes.count ?? 0;
    argMode = argMatch !== null;

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
      {argMode && <ArgentinaMode />}
      <Sidebar playerCount={playerCount} isAdmin={isAdmin} />
      <div className="lg:pl-60">
        <AppShell>{children}</AppShell>
      </div>
      <BottomNav />
    </>
  );
}
