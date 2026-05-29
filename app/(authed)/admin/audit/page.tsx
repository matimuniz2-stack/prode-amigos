import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  match_set_result: "Cargó resultado",
  recalc_match: "Recalculó un partido",
  recalc_all: "Recalculó todo",
  resolve_global: "Resolvió un global",
  resolve_ko_round: "Abrió un cruce KO",
  revert_ko_round: "Revirtió un cruce KO",
  admin_view_predictions: "Vio picks de un usuario",
};

const fmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default async function AdminAuditPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, action, actor_role, target_table, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Auditoría</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>

      {!rows || rows.length === 0 ? (
        <p className="text-sm text-cream/70">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">
                  {ACTION_LABEL[r.action] ?? r.action}
                </span>
                <span className="shrink-0 text-xs text-ink/50">
                  {fmt.format(new Date(r.created_at))}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink/70">{r.reason}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-ink/40">
                {r.actor_role ?? "—"}
                {r.target_table ? ` · ${r.target_table}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
