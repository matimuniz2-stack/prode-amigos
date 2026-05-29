"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function updatePool(input: {
  totalAmount: number;
  currency: string;
  prizes: { rule_key: string; share_pct: number }[];
}): Promise<Result> {
  const supabase = await createClient();

  const { data: pool } = await supabase.from("pools").select("id").maybeSingle();
  if (!pool) return { ok: false, error: "No hay pozo configurado." };

  const { error: poolErr } = await supabase
    .from("pools")
    .update({ total_amount: input.totalAmount, currency: input.currency })
    .eq("id", pool.id);
  if (poolErr) {
    const m = poolErr.message.toLowerCase();
    return {
      ok: false,
      error: m.includes("row-level") ? "No tenés permisos." : poolErr.message,
    };
  }

  for (const pr of input.prizes) {
    const { error } = await supabase
      .from("prize_rules")
      .update({ share_pct: pr.share_pct })
      .eq("pool_id", pool.id)
      .eq("rule_key", pr.rule_key);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/admin/pool");
  revalidatePath("/leaderboard");
  return { ok: true };
}
