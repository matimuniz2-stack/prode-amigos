import { Avatar } from "@/components/avatar";
import { CrownedAvatar } from "@/components/crowned-avatar";
import { DeclarationInput } from "@/components/home/declaration-input";

export interface Speaker {
  id: string;
  nick: string;
  declaration: string | null;
}

/**
 * "Conferencia de prensa": después de la fecha, el crack 🥇 y el papelón 💀
 * dan declaraciones. Si sos uno de ellos, podés escribir/editar la tuya.
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
          {sp.declaration ? (
            <p className="mt-0.5 text-xs italic text-ink/70">
              “{sp.declaration}”
            </p>
          ) : (
            !isMe && (
              <p className="mt-0.5 text-[11px] text-ink/40">
                Todavía no declaró… 🦗
              </p>
            )
          )}
          {isMe && <DeclarationInput dayKey={dayKey} initial={sp.declaration} />}
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
