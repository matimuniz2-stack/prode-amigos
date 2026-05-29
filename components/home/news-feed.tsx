import type { DemoNews } from "@/lib/demo-data";

/** Feed de novedades/cargadas (cards oscuras translúcidas). */
export function NewsFeed({ items }: { items: DemoNews[] }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((n, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl bg-black/20 px-4 py-3 text-sm text-cream ring-1 ring-cream/10 backdrop-blur"
        >
          <span aria-hidden className="text-base leading-none">
            {n.emoji}
          </span>
          <span className="leading-snug">{n.text}</span>
        </div>
      ))}
    </div>
  );
}
