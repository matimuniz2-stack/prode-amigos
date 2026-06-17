"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { setAvatarUrl } from "@/app/(authed)/mi-prode/actions";
import { cn } from "@/lib/utils";

/**
 * "Cambiá tu foto al toque": subís una imagen al bucket 'avatars' (carpeta
 * propia por uid) desde el cliente y se guarda la URL pública en el perfil.
 */
export function AvatarUploader({
  userId,
  initialUrl,
  name,
}: {
  userId: string;
  initialUrl: string | null;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permitir re-subir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ type: "err", text: "Tiene que ser una imagen." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: "err", text: "La imagen no puede superar 5 MB." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const path = `${userId}/avatar.${ext || "jpg"}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw new Error(upErr.message);
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const busted = `${pub.publicUrl}?v=${Date.now()}`; // evita cache vieja
      const res = await setAvatarUrl(busted);
      if (!res.ok) throw new Error(res.error);
      setUrl(busted);
      setMsg({ type: "ok", text: "Foto actualizada ✓" });
    } catch (err) {
      setMsg({
        type: "err",
        text: err instanceof Error ? err.message : "No se pudo subir la foto.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <Avatar src={url} name={name} className="size-16 text-2xl" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-extrabold">📸 Tu foto</span>
        <p className="text-xs text-ink/55">
          Subí tu avatar — lo ven todos en el ranking. Máx 5 MB.
        </p>
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
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-full bg-pitch px-4 py-2 text-sm font-bold text-cream transition-transform active:scale-95 disabled:opacity-50"
      >
        {busy ? "Subiendo…" : "Cambiar foto"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPick}
        className="hidden"
      />
    </div>
  );
}
