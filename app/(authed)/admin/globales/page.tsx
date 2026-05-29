import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";
import { GlobalResolver } from "@/components/admin/global-resolver";

export const dynamic = "force-dynamic";

const CATS = [
  { key: "champion", label: "🏆 Campeón", type: "team" as const },
  { key: "runner_up", label: "🥈 Subcampeón", type: "team" as const },
  { key: "top_scorer", label: "👟 Goleador", type: "player" as const },
  { key: "mvp", label: "⭐ MVP", type: "player" as const },
  { key: "revelation", label: "🌟 Revelación", type: "player" as const },
];

export default async function AdminGlobalesPage() {
  const supabase = await createClient();

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, flag_emoji")
    .order("name", { ascending: true });

  const { data: picks } = await supabase
    .from("global_predictions")
    .select("category, player_name");

  function variantsFor(cat: string) {
    const map = new Map<string, number>();
    for (const p of picks ?? []) {
      if (p.category === cat && p.player_name) {
        const key = p.player_name.trim();
        if (key) map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Globales</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>

      <p className="text-sm text-cream/70">
        Al final del torneo, definí el resultado real de cada categoría y suma
        puntos a los que acertaron. En goleador/MVP/revelación matchea por
        equipo + nombre (sin distinguir mayúsculas) — usá los chips para ver qué
        cargó cada uno.
      </p>

      {CATS.map((c) => (
        <GlobalResolver
          key={c.key}
          category={c.key}
          label={c.label}
          type={c.type}
          teams={teams ?? []}
          variants={c.type === "player" ? variantsFor(c.key) : []}
        />
      ))}
    </div>
  );
}
