"use client";

import { useRef, useState, useTransition } from "react";
import { postDeclaration } from "@/app/(authed)/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Initial = {
  text: string | null;
  audioUrl: string | null;
  photoUrl: string | null;
} | null;

type Pending = { blob: Blob; ext: string };

/** Elige el mejor mimeType de audio soportado por el navegador. */
function pickAudioMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/**
 * Input de la declaración: el crack/papelón puede cargar foto + audio + texto,
 * todo junto y apilado. Cada uno es opcional; se guardan los tres de una.
 */
export function DeclarationInput({
  dayKey,
  userId,
  initial,
}: {
  dayKey: string;
  userId: string;
  initial: Initial;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  // URLs ya guardadas (las que vinieron de la base).
  const [savedPhoto, setSavedPhoto] = useState<string | null>(
    initial?.photoUrl ?? null,
  );
  const [savedAudio, setSavedAudio] = useState<string | null>(
    initial?.audioUrl ?? null,
  );
  // Archivos nuevos elegidos/grabados pero todavía sin subir.
  const [pendingPhoto, setPendingPhoto] = useState<Pending | null>(null);
  const [pendingAudio, setPendingAudio] = useState<Pending | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const photoFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const photoSrc = photoPreview ?? savedPhoto;
  const audioSrc = audioPreview ?? savedAudio;

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
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    const ext = (file.name.split(".").pop() || "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setPendingPhoto({ blob: file, ext: ext || "jpg" });
    setPhotoPreview(URL.createObjectURL(file));
    setMsg(null);
  }

  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPendingPhoto(null);
    setSavedPhoto(null);
  }

  // ---- Audio ----
  async function startRec() {
    setMsg(null);
    const mime = pickAudioMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      audioFileRef.current?.click();
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
        if (audioPreview) URL.revokeObjectURL(audioPreview);
        setPendingAudio({ blob, ext });
        setAudioPreview(URL.createObjectURL(blob));
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setMsg({
        type: "err",
        text: "No pude acceder al micrófono. Probá subir un archivo.",
      });
      audioFileRef.current?.click();
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
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    const ext = (file.name.split(".").pop() || "m4a")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    setPendingAudio({ blob: file, ext: ext || "m4a" });
    setAudioPreview(URL.createObjectURL(file));
    setMsg(null);
  }

  function removeAudio() {
    if (audioPreview) URL.revokeObjectURL(audioPreview);
    setAudioPreview(null);
    setPendingAudio(null);
    setSavedAudio(null);
  }

  // ---- Guardar (sube lo pendiente y manda las tres) ----
  async function uploadPending(p: Pending, kind: "audio" | "photo") {
    const supabase = createClient();
    const path = `${userId}/${dayKey}-${kind}.${p.ext}`;
    const { error: upErr } = await supabase.storage
      .from("declarations")
      .upload(path, p.blob, {
        upsert: true,
        cacheControl: "3600",
        contentType: p.blob.type || undefined,
      });
    if (upErr) throw new Error(upErr.message);
    const { data: pub } = supabase.storage
      .from("declarations")
      .getPublicUrl(path);
    return `${pub.publicUrl}?v=${Date.now()}`;
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      try {
        let photoUrl = savedPhoto;
        let audioUrl = savedAudio;
        if (pendingPhoto) photoUrl = await uploadPending(pendingPhoto, "photo");
        if (pendingAudio) audioUrl = await uploadPending(pendingAudio, "audio");

        const res = await postDeclaration(dayKey, text, audioUrl, photoUrl);
        if (res.ok) {
          // Lo pendiente ya quedó guardado: pasa a "saved".
          setSavedPhoto(photoUrl);
          setSavedAudio(audioUrl);
          setPendingPhoto(null);
          setPendingAudio(null);
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

  const hasSomething = !!text.trim() || !!photoSrc || !!audioSrc;
  const alreadyDeclared = !!initial;

  return (
    <form onSubmit={submit} className="mt-1.5 flex flex-col gap-2.5">
      {/* Foto */}
      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-ink/50">📸 Foto</span>
        {photoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt="Vista previa"
            className="max-h-48 w-auto max-w-full rounded-lg object-contain"
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => photoFileRef.current?.click()}
            disabled={pending}
            className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-ink/70 transition active:scale-95 disabled:opacity-50"
          >
            {photoSrc ? "Cambiar foto" : "Elegir foto"}
          </button>
          {photoSrc && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={pending}
              className="rounded-full px-2 py-1.5 text-xs font-bold text-cardred transition active:scale-95 disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        <input
          ref={photoFileRef}
          type="file"
          accept="image/*"
          onChange={onPickPhoto}
          className="hidden"
        />
      </section>

      {/* Audio */}
      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-ink/50">🎙️ Audio</span>
        {audioSrc && !recording && (
          <audio
            controls
            preload="none"
            src={audioSrc}
            className="h-9 w-full max-w-[260px]"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!recording ? (
            <button
              type="button"
              onClick={startRec}
              disabled={pending}
              className="rounded-full bg-cardred px-3 py-1.5 text-xs font-bold text-cream transition active:scale-95 disabled:opacity-50"
            >
              ⏺ {audioSrc ? "Regrabar" : "Grabar"}
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
            onClick={() => audioFileRef.current?.click()}
            disabled={pending || recording}
            className="rounded-full bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-ink/60 transition active:scale-95 disabled:opacity-50"
          >
            Subir archivo
          </button>
          {audioSrc && !recording && (
            <button
              type="button"
              onClick={removeAudio}
              disabled={pending}
              className="px-2 py-1.5 text-xs font-bold text-cardred transition active:scale-95 disabled:opacity-50"
            >
              Quitar
            </button>
          )}
        </div>
        <input
          ref={audioFileRef}
          type="file"
          accept="audio/*"
          onChange={onPickAudioFile}
          className="hidden"
        />
      </section>

      {/* Texto */}
      <section className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-ink/50">✍️ Texto</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          maxLength={240}
          placeholder="Dejá tu declaración…"
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors focus:border-gold disabled:opacity-50"
        />
      </section>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || recording || !hasSomething}
          className="shrink-0 rounded-full bg-pitch px-4 py-1.5 text-xs font-bold text-cream transition active:scale-95 disabled:opacity-40"
        >
          {pending ? "Guardando…" : alreadyDeclared ? "Actualizar" : "Declarar"}
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
