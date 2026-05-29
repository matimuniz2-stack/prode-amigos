"use client";

import { useState, useTransition } from "react";
import { adminUpdateNickname } from "@/app/(authed)/admin/participants/actions";
import { cn } from "@/lib/utils";

export function ParticipantRow({
  userId,
  nickname,
  email,
  role,
}: {
  userId: string;
  nickname: string;
  email: string;
  role: string;
}) {
  const [value, setValue] = useState(nickname);
  const [saved, setSaved] = useState(nickname);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const changed = value.trim() !== saved && value.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await adminUpdateNickname(userId, value);
      if (res.ok) {
        setSaved(value.trim());
        setMsg({ type: "ok", text: "Guardado ✓" });
      } else {
        setMsg({ type: "err", text: res.error });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-2xl bg-cream p-3.5 text-ink shadow-card ring-1 ring-black/5"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-ink/50">
        <span className="truncate">{email}</span>
        {role !== "player" && (
          <span className="shrink-0 rounded-full bg-gold/25 px-2 py-0.5 font-bold uppercase text-ink/70">
            {role}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isPending}
          maxLength={24}
          className="flex-1 rounded-xl border-2 border-ink/15 bg-white px-3 py-2 font-medium text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!changed || isPending}
          className="rounded-full bg-pitch px-4 py-2 text-sm font-bold text-cream transition-transform active:scale-95 disabled:opacity-40"
        >
          {isPending ? "..." : "Guardar"}
        </button>
      </div>
      {msg && (
        <p
          className={cn(
            "text-xs font-semibold",
            msg.type === "ok" ? "text-grass" : "text-cardred",
          )}
        >
          {msg.text}
        </p>
      )}
    </form>
  );
}
