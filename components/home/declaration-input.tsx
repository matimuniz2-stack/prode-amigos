"use client";

import { useState, useTransition } from "react";
import { postDeclaration } from "@/app/(authed)/dashboard/actions";
import { cn } from "@/lib/utils";

/** Input para que el crack/papelón deje su declaración de la fecha. */
export function DeclarationInput({
  dayKey,
  initial,
}: {
  dayKey: string;
  initial: string | null;
}) {
  const [text, setText] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();
  const changed = text.trim() !== saved && text.trim().length > 0;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await postDeclaration(dayKey, text);
      if (res.ok) {
        setSaved(text.trim());
        setMsg({ type: "ok", text: "¡Declaraste! 🎙️" });
      } else {
        setMsg({ type: "err", text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="mt-1.5 flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          maxLength={240}
          placeholder="Dejá tu declaración…"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!changed || pending}
          className="shrink-0 rounded-full bg-pitch px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95 disabled:opacity-40"
        >
          {pending ? "…" : saved ? "Editar" : "Declarar"}
        </button>
      </div>
      {msg && (
        <span
          className={cn(
            "text-[11px] font-semibold",
            msg.type === "ok" ? "text-grass" : "text-cardred",
          )}
        >
          {msg.text}
        </span>
      )}
    </form>
  );
}
