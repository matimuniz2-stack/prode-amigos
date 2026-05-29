import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

/** Guard: solo admin/owner entran al panel. El resto va al dashboard. */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", claims.claims.sub as string)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
