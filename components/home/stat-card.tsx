import { cn } from "@/lib/utils";

/** Card compacta de resumen (Puesto / Próximo partido / Racha). */
export function StatCard({
  emoji,
  label,
  children,
  className,
}: {
  emoji: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl bg-cream p-3 text-ink shadow-card ring-1 ring-black/5",
        className,
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink/55">
        <span aria-hidden className="text-sm leading-none">
          {emoji}
        </span>
        <span className="leading-tight">{label}</span>
      </div>
      <div className="text-sm font-extrabold leading-tight text-ink">
        {children}
      </div>
    </div>
  );
}
