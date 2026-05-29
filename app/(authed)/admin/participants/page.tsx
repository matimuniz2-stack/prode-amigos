import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionHeading } from "@/components/home/section-heading";
import { ParticipantRow } from "@/components/admin/participant-row";

export const dynamic = "force-dynamic";

export default async function AdminParticipantsPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname, email, role")
    .order("nickname", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pt-1">
        <SectionHeading>Participantes</SectionHeading>
        <Link
          href="/admin"
          className="shrink-0 text-sm font-semibold text-cream/70 hover:text-cream"
        >
          ← Panel
        </Link>
      </div>

      <p className="text-sm text-cream/70">
        Corregí el apodo de cualquier jugador (los resultados quedan blindados:
        no se tocan). Las etiquetas se habilitan cuando apliques la migración de
        tags.
      </p>

      {!profiles || profiles.length === 0 ? (
        <p className="text-sm text-cream/70">Todavía no hay jugadores.</p>
      ) : (
        <div className="flex flex-col gap-2.5 md:grid md:grid-cols-2 md:items-start">
          {profiles.map((p) => (
            <ParticipantRow
              key={p.id}
              userId={p.id}
              nickname={p.nickname}
              email={p.email}
              role={p.role}
            />
          ))}
        </div>
      )}
    </div>
  );
}
