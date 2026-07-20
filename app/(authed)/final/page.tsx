import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/utils";
import { getFinalData } from "@/lib/final";
import { SectionHeading } from "@/components/home/section-heading";
import { Ceremonia } from "@/components/final/ceremonia";
import { ShareVideo } from "@/components/final/share-video";
import { ShareButton } from "@/components/share-button";
import { Avatar } from "@/components/avatar";

export const dynamic = "force-dynamic";

const PELICULA_SRC = "/pelicula-del-prode.mp4";

/** "A", "A y B", "A, B y C" — los empates son moneda corriente acá. */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

export default async function FinalPage() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect("/auth/login");
  }

  const data = await getFinalData(supabase);

  if (!data.done || !data.champion) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
        <SectionHeading>El Gran Final</SectionHeading>
        <p className="text-sm text-cream/70">
          Esto se abre cuando termine la final del Mundial. Todavía se está
          jugando — andá a{" "}
          <Link href="/sala-en-vivo" className="font-bold text-gold underline">
            la sala en vivo
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pt-1">
      <SectionHeading>El Gran Final</SectionHeading>

      {data.finalScore && (
        <div className="rounded-2xl bg-cream p-4 text-center text-ink shadow-card ring-1 ring-black/5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
            La final del mundo
          </div>
          <div className="text-xl font-black">{data.finalScore}</div>
          <div className="text-xs font-semibold text-ink/60">
            Se terminó el Mundial 2026 — y el prode también.
          </div>
        </div>
      )}

      {/* 1. La ceremonia */}
      <Ceremonia podium={data.podium} last={data.last} currency={data.currency} />

      {/* 2. La foto del campeón */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>La foto del campeón</SectionHeading>
          <ShareButton
            endpoint="/api/share/campeon"
            filename="campeon-del-prode.png"
            label="Compartir"
            text={`${data.champion.nickname} campeón del prode 🏆👑`}
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/share/campeon"
          alt={`${data.champion.nickname}, campeón del prode`}
          loading="lazy"
          className="w-full rounded-2xl shadow-card ring-1 ring-cream/10"
        />
        <p className="text-xs text-cream/50">
          Para imprimir, poner de fondo de pantalla o spamear el grupo.
        </p>
      </section>

      {/* 3. Los premios del prode */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Los premios del prode</SectionHeading>
        <p className="-mt-2 text-xs text-cream/60">
          Los honoríficos del torneo — salen solos de la data, acá no vota
          nadie.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.premios.map((p) => (
            <div
              key={p.title}
              className="flex items-center gap-3 rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5"
            >
              <span className="text-3xl">{p.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
                  {p.title}
                </div>
                <div className="flex items-center gap-1.5">
                  {p.winners.slice(0, 4).map((w) => (
                    <Avatar
                      key={w.nickname}
                      src={w.avatarUrl}
                      name={w.nickname}
                      className="size-6 text-[10px]"
                    />
                  ))}
                  <span className="truncate text-sm font-extrabold">
                    {joinNames(p.winners.map((w) => w.nickname))}
                  </span>
                </div>
                <div className="truncate text-xs font-semibold text-ink/60">
                  {p.stat} · {p.desc.toLowerCase()}
                </div>
              </div>
              <span className="text-xl">🏆</span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. La película del prode */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading>La película del prode</SectionHeading>
          <ShareVideo
            src={PELICULA_SRC}
            filename="la-pelicula-del-prode.mp4"
            text="La película del prode 🎬🏆"
          />
        </div>
        <p className="-mt-2 text-xs text-cream/60">
          El Mundial entero en un minuto: la carrera partido a partido hasta la
          coronación.
        </p>
        <video
          controls
          playsInline
          preload="metadata"
          src={PELICULA_SRC}
          className="mx-auto w-full max-w-sm rounded-2xl shadow-card ring-1 ring-cream/10"
        />
      </section>
    </div>
  );
}
