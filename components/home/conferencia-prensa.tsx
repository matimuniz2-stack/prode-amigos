import { Avatar } from "@/components/avatar";
import { CrownedAvatar } from "@/components/crowned-avatar";
import { DeclarationInput } from "@/components/home/declaration-input";

export interface Speaker {
  id: string;
  nick: string;
  declaration: {
    kind: "text" | "audio" | "photo";
    text: string | null;
    mediaUrl: string | null;
  } | null;
}

/**
 * "Conferencia de prensa": después de la fecha, el crack 🥇 y el papelón 💀
 * dan declaraciones (texto, audio o foto). Si sos uno de ellos, podés
 * escribir/grabar/subir la tuya.
 */
export function ConferenciaPrensa({
  dayLabel,
  dayKey,
  crack,
  papelon,
  myId,
}: {
  dayLabel: string;
  dayKey: string;
  crack: Speaker | null;
  papelon: Speaker | null;
  myId: string;
}) {
  if (!crack && !papelon) return null;

  const row = (sp: Speaker, role: "crack" | "papelon") => {
    const isMe = sp.id === myId;
    const decl = sp.declaration;
    return (
      <div key={role} className="flex gap-3 rounded-xl bg-ink/[0.03] p-2.5">
        {role === "crack" ? (
          <CrownedAvatar crowned name={sp.nick} className="size-9 text-sm" />
        ) : (
          <Avatar name={sp.nick} className="size-9 text-sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="truncate text-sm font-bold">{sp.nick}</span>
            <span className="text-[10px] font-bold text-ink/45">
              {role === "crack" ? "🥇 el crack declara" : "💀 el papelón declara"}
            </span>
          </div>
          {decl ? (
            <DeclarationView decl={decl} />
          ) : (
            !isMe && (
              <p className="mt-0.5 text-[11px] text-ink/40">
                Todavía no declaró… 🦗
              </p>
            )
          )}
          {isMe && (
            <DeclarationInput dayKey={dayKey} userId={myId} initial={decl} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink/50">
        🎙️ Conferencia de prensa · {dayLabel}
      </span>
      {crack && row(crack, "crack")}
      {papelon && papelon.id !== crack?.id && row(papelon, "papelon")}
    </div>
  );
}

/** Render de la declaración ya guardada, según el tipo. */
function DeclarationView({
  decl,
}: {
  decl: NonNullable<Speaker["declaration"]>;
}) {
  if (decl.kind === "audio" && decl.mediaUrl) {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <audio
          controls
          preload="none"
          src={decl.mediaUrl}
          className="h-9 w-full max-w-[260px]"
        />
        {decl.text && (
          <p className="text-xs italic text-ink/70">“{decl.text}”</p>
        )}
      </div>
    );
  }
  if (decl.kind === "photo" && decl.mediaUrl) {
    return (
      <div className="mt-1 flex flex-col gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={decl.mediaUrl}
          alt="Declaración"
          className="max-h-60 w-auto max-w-full rounded-lg object-contain"
        />
        {decl.text && (
          <p className="text-xs italic text-ink/70">“{decl.text}”</p>
        )}
      </div>
    );
  }
  // texto (o fallback si faltara el media)
  return decl.text ? (
    <p className="mt-0.5 text-xs italic text-ink/70">“{decl.text}”</p>
  ) : null;
}
