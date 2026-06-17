"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface PaletteItem {
  href: string;
  label: string;
  hint?: string;
}

/**
 * Buscador global ⌘K: salta a cualquier sección. Se abre con ⌘K / Ctrl+K, con
 * Esc cierra, ↑↓ se mueve y Enter entra. También escucha el evento
 * "open-palette" para abrirlo desde un botón (sidebar).
 */
export function CommandPalette({ items }: { items: PaletteItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.label.toLowerCase().includes(s)) : items;
  }, [q, items]);

  useEffect(() => {
    setSel(0);
  }, [q]);

  if (!open) return null;

  function go(i: PaletteItem | undefined) {
    if (!i) return;
    setOpen(false);
    router.push(i.href);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/55 p-4 pt-[12vh] animate-[fade-up_.2s_ease]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-cream text-ink shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2.5">
          <span aria-hidden className="text-base">
            🔎
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(filtered.length - 1, s + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(filtered[sel]);
              }
            }}
            placeholder="Saltá a una sección…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink/40"
          />
          <span className="rounded-md bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink/50">
            ESC
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-ink/50">
              Nada con “{q}”
            </p>
          ) : (
            filtered.map((i, idx) => (
              <button
                key={i.href}
                type="button"
                onMouseEnter={() => setSel(idx)}
                onClick={() => go(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                  idx === sel ? "bg-pitch text-cream" : "text-ink hover:bg-ink/5",
                )}
              >
                {i.label}
                {i.hint && (
                  <span
                    className={cn(
                      "ml-auto text-[11px]",
                      idx === sel ? "text-cream/60" : "text-ink/40",
                    )}
                  >
                    {i.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-ink/10 px-3 py-1.5 text-[10px] text-ink/40">
          ↑↓ moverte · Enter entrar · ⌘K abrir/cerrar
        </div>
      </div>
    </div>
  );
}
