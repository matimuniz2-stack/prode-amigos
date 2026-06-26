"use client";

import { useRef, useState, useTransition } from "react";
import { postDeclaration } from "@/app/(authed)/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Kind = "text" | "audio" | "photo";

type Initial = {
  kind: "text" | "audio" | "photo";
  text: string | null;
  mediaUrl: string | null;
} | null;

const TABS: { kind: Kind; label: string }[] = [
  { kind: "text", label: "✍️ Texto" },
  { kind: "audio", label: "🎙️ Audio" },
  { kind: "photo", label: "📸 Foto" },
];

/** Elige el mejor mimeType de audio soportado por el navegador. */
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/** Input para que el crack/papelón deje su declaración: texto, audio o foto. */
export function DeclarationInput({
  dayKey,
  userId,
  initial,
}: {
  dayKey: string;
  userId: string;
  initial: Initial;
}) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "text");
  const [text, setText] = useState(initial?.text ?? "");
  const [hasDecl, setHasDecl] = useState(!!initial);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  // Archivo/blob elegido pero todavía no subido (foto o audio).
  const [media, setMedia] = useState<{ blob: Blob; ext: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Estado de grabación de audio.
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);

  function resetMedia() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMedia(null);
  }

  function switchKind(k: Kind) {
    if (k === kind) return;
    resetMedia();
    setMsg(null);
    setKind(k);
  }

  // ---- Foto ----
  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ type: "err", text: "Tiene que ser una imagen." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: "err", text: "La imagen no puede superar 5 MB." });
      return;
    }
    resetMedia();
    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setMedia({ blob: file, ext: ext || "jpg" });
    setPreviewUrl(URL.createObjectURL(file));
    setMsg(null);
  }

  // ---- Audio (grabación) ----
  async function startRec() {
    setMsg(null);
    const mime = pickAudioMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      // Fallback: subir un archivo de audio.
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("mp4")
          ? "mp4"
          : mime.includes("ogg")
            ? "ogg"
            : "webm";
        resetMedia();
        setMedia({ blob, ext });
        setPreviewUrl(URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMsg({
        type: "err",
        text: "No pude acceder al micrófono. Probá subir un archivo.",
      });
      fileRef.current?.click();
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  function onPickAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setMsg({ type: "err", text: "Tiene que ser un audio." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ type: "err", text: "El audio no puede superar 10 MB." });
      return;
    }
    resetMedia();
    const ext = (file.name.split(".").pop() || "m4a")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setMedia({ blob: file, ext: ext || "m4a" });
    setPreviewUrl(URL.createObjectURL(file));
    setMsg(null);
  }

  // ---- Guardar ----
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        let mediaUrl: string | null = null;
        if (kind !== "text") {
          if (!media) {
            setMsg({
              type: "err",
              text: kind === "audio" ? "Grabá o subí un audio." : "Elegí una foto.",
            });
            return;
          }
          const supabase = createClient();
          const path = `${userId}/${dayKey}-${kind}.${media.ext}`;
          const { error: upErr } = await supabase.storage
            .from("declarations")
            .upload(path, media.blob, {
              upsert: true,
              cacheControl: "3600",
              contentType: media.blob.type || undefined,
            });
          if (upErr) throw new Error(upErr.message);
          const { data: pub } = supabase.storage
            .from("declarations")
            .getPublicUrl(path);
          mediaUrl = `${pub.publicUrl}?v=${Date.now()}`;
        }
        const res = await postDeclaration(dayKey, text, kind, mediaUrl);
        if (res.ok) {
          setHasDecl(true);
          resetMedia();
          setMsg({ type: "ok", text: "¡Declaraste! 🎙️" });
        } else {
          setMsg({ type: "err", text: res.error });
        }
      } catch (err) {
        setMsg({
          type: "err",
          text: err instanceof Error ? err.message : "No se pudo guardar.",
        });
      }
    });
  }

  const ctaLabel = pending ? "…" : hasDecl ? "Actualizar" : "Declarar";

  return (
    <form onSubmit={submit} className="mt-1.5 flex flex-col gap-1.5">
      {/* Selector de tipo */}
      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => switchKind(t.kind)}
            disabled={pending || recording}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50",
              kind === t.kind
                ? "bg-pitch text-cream"
                : "bg-ink/[0.06] text-ink/60",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Texto */}
      {kind === "text" && (
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          maxLength={240}
          placeholder="Dejá tu declaración…"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
        />
      )}

      {/* Audio */}
      {kind === "audio" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {!recording ? (
              <button
                type="button"
                onClick={startRec}
                disabled={pending}
                className="rounded-full bg-cardred px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95 disabled:opacity-50"
              >
                ⏺ {media ? "Regrabar" : "Grabar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRec}
                className="animate-pulse rounded-full bg-cardred px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95"
              >
                ⏹ Frenar
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending || recording}
              className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-ink/60 transition active:scale-95 disabled:opacity-50"
            >
              Subir archivo
            </button>
          </div>
          {previewUrl && !recording && (
            <audio controls preload="none" src={previewUrl} className="h-9 w-full max-w-[260px]" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            onChange={onPickAudioFile}
            className="hidden"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
            maxLength={240}
            placeholder="Texto opcional…"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
          />
        </div>
      )}

      {/* Foto */}
      {kind === "photo" && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="self-start rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-ink/70 transition active:scale-95 disabled:opacity-50"
          >
            {media ? "Cambiar foto" : "📸 Elegir foto"}
          </button>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa"
              className="max-h-48 w-auto max-w-full rounded-lg object-contain"
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPickPhoto}
            className="hidden"
          />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
            maxLength={240}
            placeholder="Texto opcional…"
            className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || recording}
          className="shrink-0 rounded-full bg-pitch px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95 disabled:opacity-40"
        >
          {ctaLabel}
        </button>
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
      </div>
    </form>
  );
}
