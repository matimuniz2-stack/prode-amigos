"use client";

import { useState, useTransition } from "react";
import { updatePool } from "@/app/(authed)/admin/pool/actions";
import { cn } from "@/lib/utils";

interface Initial {
  totalAmount: number;
  currency: string;
  first: number;
  second: number;
  third: number;
}

const field =
  "w-full rounded-xl border-2 border-ink/15 bg-white px-3 py-2.5 font-medium text-ink outline-none transition-colors focus:border-gold disabled:opacity-50";

function PctRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 font-bold">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className={cn(field, "flex-1")}
      />
      <span className="text-ink/50">%</span>
    </div>
  );
}

export function PoolForm({ initial }: { initial: Initial }) {
  const [amount, setAmount] = useState(String(initial.totalAmount));
  const [currency, setCurrency] = useState(initial.currency);
  const [first, setFirst] = useState(String(initial.first));
  const [second, setSecond] = useState(String(initial.second));
  const [third, setThird] = useState(String(initial.third));
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const sum = (Number(first) || 0) + (Number(second) || 0) + (Number(third) || 0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updatePool({
        totalAmount: Number(amount) || 0,
        currency,
        prizes: [
          { rule_key: "overall_1st", share_pct: Number(first) || 0 },
          { rule_key: "overall_2nd", share_pct: Number(second) || 0 },
          { rule_key: "overall_3rd", share_pct: Number(third) || 0 },
        ],
      });
      setMsg(
        res.ok
          ? { type: "ok", text: "Guardado ✓" }
          : { type: "err", text: res.error },
      );
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <label className="text-sm font-extrabold">Monto del pozo</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            disabled={isPending}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className={field}
          />
          <select
            value={currency}
            disabled={isPending}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-24 rounded-xl border-2 border-ink/15 bg-white px-2 font-bold text-ink outline-none focus:border-gold disabled:opacity-50"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <p className="text-xs text-ink/55">
          Los pagos se gestionan afuera de la app — esto es solo lo que se
          muestra en el ranking.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
        <label className="text-sm font-extrabold">Reparto del pozo</label>
        <PctRow label="🥇 1°" value={first} onChange={setFirst} disabled={isPending} />
        <PctRow label="🥈 2°" value={second} onChange={setSecond} disabled={isPending} />
        <PctRow label="🥉 3°" value={third} onChange={setThird} disabled={isPending} />
        <p
          className={cn(
            "text-xs font-semibold",
            sum === 100 ? "text-grass" : "text-cardred",
          )}
        >
          Suma: {sum}%{sum !== 100 && " — debería dar 100"}
        </p>
      </div>

      {msg && (
        <p
          className={cn(
            "text-center text-sm font-semibold",
            msg.type === "ok" ? "text-grass" : "text-cardred",
          )}
        >
          {msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-pitch px-4 py-3 text-sm font-bold text-cream transition-all hover:bg-pitch-deep active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "Guardando..." : "Guardar pozo"}
      </button>
    </form>
  );
}
