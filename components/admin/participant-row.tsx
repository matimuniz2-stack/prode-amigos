"use client";

import { useState, useTransition } from "react";
import {
  adminUpdateNickname,
  adminUpdateTags,
} from "@/app/(authed)/admin/participants/actions";
import { cn } from "@/lib/utils";
import { MAX_TAGS, PRESET_TAGS, TAG_TONE_CLASS } from "@/lib/tags";

export function ParticipantRow({
  userId,
  nickname,
  email,
  role,
  tags,
}: {
  userId: string;
  nickname: string;
  email: string;
  role: string;
  tags: string[];
}) {
  const [value, setValue] = useState(nickname);
  const [saved, setSaved] = useState(nickname);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const [activeTags, setActiveTags] = useState<string[]>(tags);
  const [tagMsg, setTagMsg] = useState<string | null>(null);
  const [tagPending, startTagTransition] = useTransition();

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

  const toggleTag = (label: string) => {
    const has = activeTags.includes(label);
    if (!has && activeTags.length >= MAX_TAGS) {
      setTagMsg(`Máximo ${MAX_TAGS} etiquetas.`);
      return;
    }
    const next = has
      ? activeTags.filter((t) => t !== label)
      : [...activeTags, label];
    const prev = activeTags;
    setActiveTags(next);
    setTagMsg(null);
    startTagTransition(async () => {
      const res = await adminUpdateTags(userId, next);
      if (!res.ok) {
        setActiveTags(prev); // revertir si falló
        setTagMsg(res.error);
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

      {/* Etiquetas / logros — se guardan al togglear */}
      <div className="mt-0.5 flex flex-col gap-1.5 border-t border-ink/10 pt-2.5">
        <span className="text-xs font-semibold text-ink/50">
          Etiquetas{" "}
          <span className="font-normal">
            ({activeTags.length}/{MAX_TAGS})
          </span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TAGS.map((t) => {
            const active = activeTags.includes(t.label);
            return (
              <button
                key={t.label}
                type="button"
                onClick={() => toggleTag(t.label)}
                disabled={tagPending}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold transition-all active:scale-95 disabled:opacity-50",
                  active
                    ? TAG_TONE_CLASS[t.tone]
                    : "border-ink/15 bg-white text-ink/40 hover:text-ink/70",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {tagMsg && (
          <p className="text-xs font-semibold text-cardred">{tagMsg}</p>
        )}
      </div>
    </form>
  );
}
