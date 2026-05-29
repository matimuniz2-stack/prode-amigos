import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export default async function DashboardPage() {
  if (!hasSupabaseEnv()) {
    return (
      <div className="flex flex-col gap-4 py-12">
        <h1 className="text-2xl font-bold">Faltan credenciales de Supabase</h1>
        <p className="text-sm text-muted-foreground">
          Configurá <code>.env.local</code> con{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> y reiniciá el dev
          server.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const user = data.claims;
  const email = (user.email as string) ?? "amigo";

  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold">Hola, {email}</h1>
      <p className="text-muted-foreground">
        Bienvenido al prode. Próximamente vas a ver acá: tus picks del Mundial
        2026, predicciones globales, ranking del grupo y proyección del pozo.
      </p>
      <div className="text-xs text-muted-foreground border rounded p-3">
        Estado del proyecto: <span className="font-medium">Fase 0 / 7 — Setup</span>
        . Mirá <code>PLAN.md</code> en la raíz del repo para el roadmap completo.
      </div>
    </div>
  );
}
