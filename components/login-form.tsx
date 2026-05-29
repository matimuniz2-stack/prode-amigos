"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al iniciar sesión");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {/* Branding */}
      <div className="flex flex-col items-center text-center">
        <span aria-hidden className="text-4xl leading-none">
          ⚽
        </span>
        <div className="mt-1 text-display leading-[0.85]">
          <span className="block text-3xl text-cream text-shadow-pop">
            PRODE
          </span>
          <span className="block text-3xl text-gold">DE LOS PIBES</span>
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-col gap-4 rounded-2xl bg-cream p-6 text-ink shadow-card ring-1 ring-black/5">
        <div>
          <h1 className="text-xl font-extrabold">Entrar al prode</h1>
          <p className="mt-1 text-sm text-ink/60">
            Iniciá sesión con tu cuenta de Google para cargar tus picks del
            Mundial 2026.
          </p>
        </div>
        <Button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? "Conectando..." : "Continuar con Google"}
        </Button>
        {error && <p className="text-center text-sm text-cardred">{error}</p>}
        <p className="text-center text-xs text-ink/50">
          Solo por invitación. Si tu email no fue agregado al grupo, no vas a
          poder entrar.
        </p>
      </div>
    </div>
  );
}
