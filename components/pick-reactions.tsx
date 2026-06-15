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
      {active.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={disabled || pending}
          onClick={() => react(r.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-bold tabular-nums transition active:scale-95",
            r.mine
              ? "border-pitch/40 bg-pitch/10 text-pitch"
              : "border-ink/10 bg-ink/[0.04] text-ink/70",
            disabled && "cursor-default opacity-80",
          )}
          title={r.mine ? "Sacar reacción" : "Sumarte"}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}

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
