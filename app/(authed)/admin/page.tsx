import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/results", emoji: "⚽", title: "Resultados", desc: "Cargar y finalizar partidos" },
  { href: "/admin/globales", emoji: "🏆", title: "Globales", desc: "Resolver campeón, goleador, etc." },
  { href: "/admin/brackets", emoji: "🗝️", title: "Cruces", desc: "Eliminación: 1º/2º, terceros y avance" },
  { href: "/admin/pool", emoji: "💰", title: "Pozo", desc: "Monto y reparto de premios" },
  { href: "/admin/participants", emoji: "👥", title: "Participantes", desc: "Apodos y etiquetas de los jugadores" },
  { href: "/admin/audit", emoji: "📋", title: "Auditoría", desc: "Registro de cambios" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  registration: "Inscripción abierta",
  locked: "Cerrado",
  live: "En juego",
  finished: "Terminado",
};

export default async function AdminPage() {
  const supabase = await createClient();

  // Las tres son independientes → en paralelo.
  const [tournamentRes, finishedRes, liveRes] = await Promise.all([
    supabase
      .from("tournaments")
      .select("name, status")
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "finished"),
    supabase
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("status", "live"),
  ]);
  const tournament = tournamentRes.data;
  const finishedCount = finishedRes.count;
  const liveCount = liveRes.count;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <SectionHeading className="pt-1">Panel admin</SectionHeading>

      <div className="rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-ink/55">
          Torneo
        </div>
        <div className="text-lg font-extrabold">{tournament?.name ?? "—"}</div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink/60">
          <span>
            Estado:{" "}
            <span className="font-semibold text-ink">
              {tournament ? (STATUS_LABEL[tournament.status] ?? tournament.status) : "—"}
            </span>
          </span>
          <span>{finishedCount ?? 0} finalizados</span>
          {(liveCount ?? 0) > 0 && (
            <span className="font-semibold text-cardred">{liveCount} en vivo</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5 transition-transform active:scale-[0.99]"
          >
            <div className="flex flex-col">
              <span className="font-extrabold">
                {s.emoji} {s.title}
              </span>
              <span className="text-xs text-ink/60">{s.desc}</span>
            </div>
            <span className="text-ink/40">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
