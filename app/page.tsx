import { redirect } from "next/navigation";
import { PrimaryButton } from "@/components/home/primary-button";
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
    <main className="mx-auto flex min-h-svh max-w-[480px] flex-col justify-center gap-6 px-6 py-10 text-center">
      <div className="flex flex-col items-center">
        <div className="flex items-end justify-center gap-2">
          <span aria-hidden className="mb-1 text-4xl leading-none">
            ⚽
          </span>
          <div className="text-display leading-[0.82]">
            <span className="block text-[2.75rem] text-cream text-shadow-pop">
              PRODE
            </span>
            <span className="block text-[2.75rem] text-gold drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
              DE LOS PIBES
            </span>
          </div>
          <span aria-hidden className="mb-7 text-2xl leading-none">
            👑
          </span>
        </div>
        <p className="mt-3 text-base font-medium text-cream/85">
          Predicciones, cargadas y gloria eterna.
        </p>
      </div>

      <p className="text-sm text-cream/70">
        Predicciones partido a partido, ranking en vivo y pozo entre los amigos.
        Solo por invitación.
      </p>

      <PrimaryButton href="/auth/login">Entrar con Google</PrimaryButton>

      <p className="text-xs text-cream/55">Arranca el 11 de junio.</p>

      {!hasSupabaseEnv() && (
        <p className="text-xs text-amber-300">
          Configurá <code>.env.local</code> con las keys de Supabase para
          habilitar el login.
        </p>
      )}

      <footer className="mt-4 text-xs text-cream/40">
        PRODE DE LOS PIBES · 2026
      </footer>
    </main>
  );
}
