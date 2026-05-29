import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";

export default async function Home() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-svh flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full flex flex-col gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            PRODE LOS PIBES
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Mundial 2026
          </p>
          <p className="text-sm text-muted-foreground">
            Predicciones partido a partido, globales del torneo, ranking en
            vivo y pozo entre los amigos. Solo por invitación.
          </p>
          <p className="text-xs text-muted-foreground">
            Arranca el 11 de junio.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link href="/auth/login">Entrar con Google</Link>
          </Button>
          {!hasSupabaseEnv() && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Configurá <code>.env.local</code> con las keys de Supabase para
              habilitar el login.
            </p>
          )}
        </div>
      </div>
      <footer className="w-full border-t text-xs flex items-center justify-center gap-4 py-4 text-muted-foreground">
        <span>PRODE LOS PIBES · 2026</span>
        <ThemeSwitcher />
      </footer>
    </main>
  );
}
