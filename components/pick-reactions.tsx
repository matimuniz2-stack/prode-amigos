"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/(authed)/matches/[matchId]/actions";
import { REACTION_EMOJIS, type ReactionCount } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * Reacciones con emojis al pick de otro jugador (chicana post-lock).
 * Si `disabled` (es tu propio pick), muestra los conteos read-only.
 */
export function PickReactions({
  matchId,
  targetUserId,
  reactions,
  disabled = false,
}: {
  matchId: string;
  targetUserId: string;
  reactions: ReactionCount[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const countOf = (emoji: string) =>
    reactions.find((r) => r.emoji === emoji) ?? { emoji, count: 0, mine: false };

  function react(emoji: string) {
    if (disabled || pending) return;
    setOpen(false);
    startTransition(async () => {
      await toggleReaction(matchId, targetUserId, emoji);
      router.refresh();
    });
  }

  const active = reactions.filter((r) => r.count > 0);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {active.map((r) => {
        // Cada sticker cae con una rotación fija (según el emoji) tipo sello.
        const rot = ((r.emoji.codePointAt(0) ?? 0) % 3) * 9 - 9; // -9 / 0 / 9
        return (
          <button
            key={r.emoji}
            type="button"
            disabled={disabled || pending}
            onClick={() => react(r.emoji)}
            title={
              r.mine
                ? "Sacar tu sticker"
                : `${r.count} ${r.count === 1 ? "sticker" : "stickers"} · sumate`
            }
            style={{ transform: `rotate(${rot}deg)` }}
            className={cn(
              "relative -ml-1.5 transition first:ml-0 active:scale-90 disabled:cursor-default",
              r.mine && "scale-110",
            )}
          >
            <span
              className="block text-xl leading-none"
              style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,.35))" }}
            >
              {r.emoji}
            </span>
            {r.count > 1 && (
              <span className="absolute -bottom-1 -right-1 grid min-w-[14px] place-items-center rounded-full bg-pitch px-0.5 text-[9px] font-black text-cream">
                {r.count}
              </span>
            )}
          </button>
        );
      })}

      {!disabled && (
        <div className="relative">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen((o) => !o)}
            className="grid size-6 place-items-center rounded-full border border-ink/10 bg-ink/[0.04] text-xs text-ink/50 transition hover:bg-ink/10 active:scale-95"
            title="Reaccionar"
          >
            ＋
          </button>
          {open && (
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-ink/10 bg-white p-1 shadow-card">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => react(e)}
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-base transition hover:bg-ink/10 active:scale-90",
                    countOf(e).mine && "bg-pitch/10",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
