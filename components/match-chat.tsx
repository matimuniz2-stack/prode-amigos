"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { sendChatMessage } from "@/app/(authed)/matches/[matchId]/actions";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  nickname: string;
  content: string;
  time: string;
  isSelf: boolean;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function MatchChat({
  matchId,
  messages,
}: {
  matchId: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    const res = await sendChatMessage(matchId, formData);
    if (res.ok) {
      formRef.current?.reset();
      startTransition(() => router.refresh());
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-black/5 pt-4">
      <AutoRefresh seconds={30} />
      <h3 className="text-sm font-extrabold">
        💬 Cancha de comentarios{" "}
        <span className="font-medium text-ink/40">({messages.length})</span>
      </h3>

      {messages.length > 0 ? (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {messages.map((m) => (
            <li key={m.id} className="flex items-start gap-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink/10 text-xs font-black text-ink/70">
                {initial(m.nickname)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-xs">
                  <span
                    className={cn(
                      "font-bold",
                      m.isSelf ? "text-pitch" : "text-ink",
                    )}
                  >
                    {m.nickname}
                    {m.isSelf && " (vos)"}
                  </span>{" "}
                  <span className="text-ink/35">{m.time}</span>
                </span>
                <span className="whitespace-pre-wrap break-words text-sm text-ink/80">
                  {m.content}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/55">
          Todavía no comentó nadie. Rompé el hielo 🧊
        </p>
      )}

      <form ref={formRef} action={onSubmit} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            name="content"
            maxLength={280}
            autoComplete="off"
            placeholder="Tirá tu análisis..."
            className="min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-pitch"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-full bg-pitch px-4 py-2 text-sm font-bold text-cream transition active:scale-95 disabled:opacity-50"
          >
            {pending ? "..." : "Enviar"}
          </button>
        </div>
        {error && <p className="text-xs font-semibold text-cardred">{error}</p>}
      </form>
    </div>
  );
}
