import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { hasSupabaseEnv } from "@/lib/utils";

export async function AuthButton() {
  if (!hasSupabaseEnv()) {
    return (
      <span className="text-xs text-amber-600 dark:text-amber-400">
        Sin Supabase
      </span>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground hidden sm:inline">
        {user.email as string}
      </span>
      <LogoutButton />
    </div>
  ) : (
    <Button asChild size="sm">
      <Link href="/auth/login">Entrar</Link>
    </Button>
  );
}
