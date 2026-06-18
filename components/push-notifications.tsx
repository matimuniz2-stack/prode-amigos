"use client";

import { useEffect, useState } from "react";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/app/(authed)/mi-prode/actions";
import { cn } from "@/lib/utils";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** La clave VAPID viaja en base64url; el navegador la quiere como bytes. */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

type State =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "not-configured"
  | "denied"
  | "off"
  | "on";

export function PushNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    async function init() {
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      if (!supported) {
        // En iPhone, Safari recién expone Web Push si la PWA está INSTALADA
        // (Agregar a pantalla de inicio) y se abre desde el ícono.
        // iPadOS 13+ se hace pasar por Safari de escritorio (UA "Macintosh"),
        // así que lo detectamos por el touch.
        const ua = navigator.userAgent;
        const isIOS =
          /iphone|ipad|ipod/i.test(ua) ||
          (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true;
        if (alive) setState(isIOS && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (!VAPID_PUBLIC) {
        if (alive) setState("not-configured");
        return;
      }
      if (Notification.permission === "denied") {
        if (alive) setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Re-guardamos (idempotente) por si el server limpió esta sub por
          // vencida: así no queda en "on" fantasma sin recibir nada.
          const json = sub.toJSON();
          await savePushSubscription({
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
            userAgent: navigator.userAgent.slice(0, 200),
          }).catch(() => {});
        }
        if (alive) setState(sub ? "on" : "off");
      } catch {
        if (alive) setState("unsupported");
      }
    }
    init();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    if (!VAPID_PUBLIC) return;
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC),
      });
      const json = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent.slice(0, 200),
      });
      if (res.ok) {
        setState("on");
        setMsg({ type: "ok", text: "¡Listo! Te vamos a avisar 🔔" });
      } else {
        // si falló el guardado, deshago la suscripción del navegador
        await sub.unsubscribe().catch(() => {});
        setMsg({ type: "err", text: res.error });
      }
    } catch (e) {
      setMsg({
        type: "err",
        text: e instanceof Error ? e.message : "No se pudo activar.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setState("off");
    } catch {
      setMsg({ type: "err", text: "No se pudo desactivar." });
    } finally {
      setBusy(false);
    }
  }

  // Sin configurar (falta la VAPID key) o cargando: no mostramos nada.
  if (state === "loading" || state === "not-configured") return null;

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <div
        className="grid size-12 shrink-0 place-items-center rounded-full bg-pitch/10 text-2xl"
        aria-hidden
      >
        🔔
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-extrabold">Notificaciones</span>
        <p className="text-xs text-ink/55">
          {state === "needs-install"
            ? "En iPhone: tocá Compartir → «Agregar a pantalla de inicio» y abrí el prode desde el ícono. Ahí vas a poder activarlas."
            : state === "unsupported"
              ? "Tu navegador no soporta notificaciones. Probá desde Chrome (Android) o instalando la app."
              : state === "denied"
                ? "Están bloqueadas. Activalas para este sitio en los ajustes del navegador y recargá."
                : "Te avisamos cuando cierra la fecha, hay gol en tu pick o te pasan en la tabla."}
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

      {state === "off" && (
        <button
          type="button"
          disabled={busy}
          onClick={enable}
          className="shrink-0 rounded-full bg-pitch px-4 py-2 text-sm font-bold text-cream transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "Activando…" : "Activar"}
        </button>
      )}
      {state === "on" && (
        <button
          type="button"
          disabled={busy}
          onClick={disable}
          className="shrink-0 rounded-full bg-ink/10 px-4 py-2 text-sm font-bold text-ink transition-transform active:scale-95 disabled:opacity-50"
        >
          {busy ? "…" : "Desactivar"}
        </button>
      )}
    </div>
  );
}
