"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";

interface Watcher {
  id: string;
  nickname: string;
  avatarUrl: string | null;
}

/**
 * Barra de "quién está mirando en vivo ahora" usando Supabase Realtime
 * Presence (sin tabla ni RLS: el estado vive en el canal). Si Realtime no está
 * disponible, simplemente no muestra nada (degradación silenciosa).
 */
export function WhoIsWatching({
  me,
  channelKey = "sala-en-vivo",
}: {
  me: { id: string; nickname: string; avatarUrl: string | null };
  channelKey?: string;
}) {
  const [watchers, setWatchers] = useState<Watcher[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${channelKey}`, {
      config: { presence: { key: me.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ nickname?: string; avatarUrl?: string | null }>
      >;
      const list: Watcher[] = Object.entries(state).map(([id, metas]) => ({
        id,
        nickname: metas[0]?.nickname ?? "Jugador",
        avatarUrl: metas[0]?.avatarUrl ?? null,
      }));
      setWatchers(list);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .track({ nickname: me.nickname, avatarUrl: me.avatarUrl })
          .catch(() => {});
      }
    });

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [me.id, me.nickname, me.avatarUrl, channelKey]);

  if (watchers.length === 0) return null;

  const sorted = [...watchers].sort((a, b) =>
    a.id === me.id
      ? -1
      : b.id === me.id
        ? 1
        : a.nickname.localeCompare(b.nickname, "es"),
  );
  const shown = sorted.slice(0, 7);
  const extra = sorted.length - shown.length;
  const others = sorted.filter((w) => w.id !== me.id);
  const caption =
    sorted.length === 1
      ? "Sos el único clavado al partido ahora mismo 👀"
      : `${others
          .slice(0, 2)
          .map((w) => w.nickname)
          .join(", ")}${
          others.length > 2 ? ` y ${others.length - 2} más` : ""
        } ${others.length === 1 ? "está" : "están"} mirando con vos 🔥`;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-3 text-ink shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/50">
          <span className="size-2 animate-pulse rounded-full bg-grass" />
          Mirando en vivo
        </span>
        <span className="rounded-full bg-grass/15 px-2 py-0.5 text-[11px] font-bold text-grass">
          {sorted.length} online
        </span>
      </div>
      <div className="flex items-center">
        {shown.map((w) => (
          <span
            key={w.id}
            title={w.nickname}
            className="-ml-2 inline-flex rounded-full ring-2 ring-cream first:ml-0"
          >
            <Avatar src={w.avatarUrl} name={w.nickname} className="size-8 text-xs" />
          </span>
        ))}
        {extra > 0 && (
          <span className="-ml-2 grid size-8 place-items-center rounded-full bg-ink/15 text-[11px] font-bold text-ink ring-2 ring-cream">
            +{extra}
          </span>
        )}
      </div>
      <p className="text-[11px] text-ink/60">{caption}</p>
    </div>
  );
}
