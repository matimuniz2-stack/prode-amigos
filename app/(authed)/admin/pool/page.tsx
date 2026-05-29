import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";
import { PoolForm } from "@/components/admin/pool-form";

export const dynamic = "force-dynamic";

export default async function AdminPoolPage() {
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, total_amount, currency")
    .maybeSingle();

  const { data: prizes } = await supabase
    .from("prize_rules")
    .select("rule_key, share_pct");

  if (!pool) {
    return (
      <p className="pt-2 text-sm text-cream/70">No hay pozo configurado.</p>
    );
  }

  const pct = (key: string) =>
    Number(prizes?.find((p) => p.rule_key === key)?.share_pct ?? 0);

  const initial = {
    totalAmount: Number(pool.total_amount ?? 0),
    currency: pool.currency ?? "ARS",
    first: pct("overall_1st"),
    second: pct("overall_2nd"),
    third: pct("overall_3rd"),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Pozo</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>
      <PoolForm initial={initial} />
    </div>
  );
}
