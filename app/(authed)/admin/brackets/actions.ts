"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TOURNAMENT_ID = "00000000-0000-0000-0000-00000000a001";

type Result = { ok: true; msg: string } | { ok: false; error: string };

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("autorizado") || m.includes("row-level")) {
    return "No tenés permisos.";
  }
  if (m.includes("does not exist") || m.includes("resolve_brackets")) {
    return "Falta aplicar la migración resolve_brackets en Supabase.";
  }
  return message;
}

/** Dispara resolve_brackets: puebla 1ro/2do y avance de los partidos terminados. */
export async function runResolveBrackets(reason: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "resolve_brackets" as never,
    {
      p_tournament_id: TOURNAMENT_ID,
      p_reason: reason.trim() || "Resolver cruces",
    } as never,
  );
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath("/admin/brackets");
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  return { ok: true, msg: `${(data as number) ?? 0} cruce(s) abierto(s).` };
}

/** Asigna los 8 mejores terceros a sus llaves y abre los cruces completos. */
export async function assignThirds(
  assignments: { matchNumber: number; teamId: string }[],
  reason: string,
): Promise<Result> {
  const filled = assignments.filter((a) => a.teamId);
  const ids = filled.map((a) => a.teamId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Hay un mismo tercero asignado a dos llaves." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "resolve_thirds" as never,
    {
      p_assignments: filled.map((a) => ({
        match: a.matchNumber,
        team: a.teamId,
      })),
      p_reason: reason.trim() || "Asignación de terceros",
    } as never,
  );
  if (error) return { ok: false, error: friendly(error.message) };

  revalidatePath("/admin/brackets");
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  return { ok: true, msg: "Terceros asignados y cruces abiertos." };
}
