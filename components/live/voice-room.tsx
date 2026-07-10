"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

/**
 * Chat de voz de la sala, sin apps ni servidores externos: WebRTC
 * navegador-a-navegador en malla (mesh). La señalización (offer/answer/ICE)
 * viaja por un canal `broadcast` de Supabase Realtime, y presence nos dice
 * quién está en la voz. Micrófono abierto (con cancelación de eco/ruido) y
 * botón de mutear. STUN público de Google; sin TURN por ahora.
 *
 * El broadcast es best-effort (un mensaje puede perderse) y los celulares se
 * suspenden en background, así que la malla se defiende sola:
 * - Cada pestaña entra con un id de sesión propio (no el user id): la misma
 *   cuenta en dos dispositivos son dos participantes y no se pisan señales.
 * - Los candidatos ICE que llegan antes de que la oferta/respuesta termine de
 *   aplicarse se encolan y se aplican después (antes se descartaban y esa
 *   pata podía quedar muda aunque el resto de la malla anduviera).
 * - El que ofrece reintenta con una oferta nueva si en unos segundos no
 *   conectó; el que espera pide re-oferta ("kick") si no le llegó nada. Las
 *   ofertas van numeradas para descartar respuestas/candidatos de intentos
 *   viejos.
 * - Al volver la pestaña a primer plano se reintenta todo lo no conectado
 *   (típico: bloqueaste el teléfono justo durante el handshake).
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** Ofertas por peer antes de marcarlo "sin señal". */
const MAX_OFFER_ATTEMPTS = 4;
/** Si la oferta no llegó a "connected" en este tiempo, va otra. */
const CONNECT_TIMEOUT_MS = 8_000;
/** El que espera oferta pide una re-oferta si pasó esto sin conectar. */
const KICK_TIMEOUT_MS = 12_000;
/** Pedidos de re-oferta antes de marcar "sin señal". */
const MAX_KICKS = 3;

type SignalKind = "offer" | "answer" | "ice" | "kick";

interface SignalPayload {
  from: string; // session id del emisor
  to: string; // session id del destinatario
  kind: SignalKind;
  /** Número de oferta; respuestas y candidatos lo repiten para poder
   *  descartar los que pertenecen a un intento ya reemplazado. */
  attempt?: number;
  data?: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface PresenceMeta {
  userId?: string;
  nickname?: string;
  avatarUrl?: string | null;
}

type PeerState = "connecting" | "connected" | "failed";

interface Peer {
  id: string; // session id
  nickname: string;
  avatarUrl: string | null;
  state: PeerState;
}

interface PeerConn {
  pc: RTCPeerConnection;
  attempt: number;
  remoteSet: boolean;
  /** Candidatos que llegaron antes de setRemoteDescription. */
  pendingIce: RTCIceCandidateInit[];
  timer: ReturnType<typeof setTimeout> | null;
}

type Status = "idle" | "connecting" | "joined";

/** Reproduce (oculto) el audio de un peer remoto. */
function PeerAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline />;
}

export function VoiceRoom({
  me,
  channelKey = "sala-en-vivo",
}: {
  me: { id: string; nickname: string; avatarUrl: string | null };
  channelKey?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>(
    {},
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connsRef = useRef<Map<string, PeerConn>>(new Map());
  // Limpieza extra armada en join() (listeners, timers de kick).
  const teardownRef = useRef<(() => void) | null>(null);

  const leave = useCallback(() => {
    teardownRef.current?.();
    teardownRef.current = null;
    connsRef.current.forEach((c) => {
      if (c.timer) clearTimeout(c.timer);
      c.pc.onicecandidate = null;
      c.pc.ontrack = null;
      c.pc.onconnectionstatechange = null;
      c.pc.close();
    });
    connsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    const ch = channelRef.current;
    if (ch) {
      ch.untrack().catch(() => {});
      ch.unsubscribe().catch(() => {});
      channelRef.current = null;
    }
    setRemoteStreams({});
    setPeers([]);
    setMuted(false);
    setStatus("idle");
  }, []);

  // Al desmontar (navegar fuera de la página) cortamos todo.
  useEffect(() => leave, [leave]);

  const join = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setError(
        "No pudimos acceder al micrófono. Fijate de darle permiso al navegador.",
      );
      setStatus("idle");
      return;
    }
    localStreamRef.current = stream;

    // Identidad en la malla: una por pestaña, no por usuario.
    const sessionId = crypto.randomUUID();

    const supabase = createClient();
    const channel = supabase.channel(`voice:${channelKey}`, {
      config: { broadcast: { self: false }, presence: { key: sessionId } },
    });
    channelRef.current = channel;
    const conns = connsRef.current;
    const offerCount = new Map<string, number>();
    const kickCount = new Map<string, number>();
    const kickTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const sendSignal = (
      to: string,
      kind: SignalKind,
      data?: SignalPayload["data"],
      attempt?: number,
    ) => {
      channel.send({
        type: "broadcast",
        event: "signal",
        payload: { from: sessionId, to, kind, attempt, data } satisfies SignalPayload,
      });
    };

    const setPeerState = (peerId: string, state: PeerState) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === peerId ? { ...p, state } : p)),
      );
    };

    const isPresent = (peerId: string) => peerId in channel.presenceState();

    // Anti-glare determinístico: ofrece siempre el de session id más chico.
    const iOffer = (peerId: string) => sessionId < peerId;

    const clearKick = (peerId: string) => {
      const t = kickTimers.get(peerId);
      if (t) {
        clearTimeout(t);
        kickTimers.delete(peerId);
      }
    };

    const dropConn = (peerId: string) => {
      const c = conns.get(peerId);
      if (!c) return;
      if (c.timer) clearTimeout(c.timer);
      c.pc.onicecandidate = null;
      c.pc.ontrack = null;
      c.pc.onconnectionstatechange = null;
      c.pc.close();
      conns.delete(peerId);
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    const flushPendingIce = async (conn: PeerConn) => {
      for (const cand of conn.pendingIce.splice(0)) {
        try {
          await conn.pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {
          // candidato duplicado/inválido: no importa, hay más caminos.
        }
      }
    };

    const newConn = (peerId: string, attempt: number): PeerConn => {
      dropConn(peerId);
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const conn: PeerConn = {
        pc,
        attempt,
        remoteSet: false,
        pendingIce: [],
        timer: null,
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerId, "ice", e.candidate.toJSON(), attempt);
      };
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        if (remote) setRemoteStreams((prev) => ({ ...prev, [peerId]: remote }));
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") {
          offerCount.set(peerId, 0);
          kickCount.set(peerId, 0);
          if (conn.timer) {
            clearTimeout(conn.timer);
            conn.timer = null;
          }
          setPeerState(peerId, "connected");
        } else if (s === "failed") {
          // Caída real (no un parpadeo): rearmamos esta pata desde cero.
          retryPeer(peerId);
        } else if (s === "disconnected") {
          // Suele volver solo; si no, pasa a "failed" y ahí reintentamos.
          setPeerState(peerId, "connecting");
        }
      };

      conns.set(peerId, conn);
      return conn;
    };

    const offerTo = async (peerId: string) => {
      if (!isPresent(peerId)) return;
      const n = (offerCount.get(peerId) ?? 0) + 1;
      if (n > MAX_OFFER_ATTEMPTS) {
        setPeerState(peerId, "failed");
        return;
      }
      offerCount.set(peerId, n);
      const conn = newConn(peerId, n);
      setPeerState(peerId, "connecting");
      try {
        const offer = await conn.pc.createOffer();
        await conn.pc.setLocalDescription(offer);
        sendSignal(peerId, "offer", offer, n);
      } catch {
        // pc cerrada en el medio (peer se fue / retry): lo cubre el timer.
      }
      conn.timer = setTimeout(() => {
        if (conns.get(peerId) !== conn) return;
        if (conn.pc.connectionState !== "connected") void offerTo(peerId);
      }, CONNECT_TIMEOUT_MS);
    };

    // Lado que espera la oferta: si en un rato no conectó, pide re-oferta.
    const scheduleKick = (peerId: string) => {
      if (kickTimers.has(peerId)) return;
      const t = setTimeout(() => {
        kickTimers.delete(peerId);
        if (!isPresent(peerId)) return;
        if (conns.get(peerId)?.pc.connectionState === "connected") return;
        const k = (kickCount.get(peerId) ?? 0) + 1;
        if (k > MAX_KICKS) {
          setPeerState(peerId, "failed");
          return;
        }
        kickCount.set(peerId, k);
        sendSignal(peerId, "kick");
        scheduleKick(peerId);
      }, KICK_TIMEOUT_MS);
      kickTimers.set(peerId, t);
    };

    const retryPeer = (peerId: string) => {
      if (!isPresent(peerId)) return;
      if (iOffer(peerId)) {
        void offerTo(peerId);
      } else {
        dropConn(peerId);
        setPeerState(peerId, "connecting");
        sendSignal(peerId, "kick");
        scheduleKick(peerId);
      }
    };

    channel.on("broadcast", { event: "signal" }, async (msg) => {
      const payload = msg.payload as SignalPayload;
      if (payload.to !== sessionId) return;
      const { from, kind, data, attempt = 0 } = payload;

      try {
        if (kind === "offer") {
          // Oferta nueva o re-oferta: esta pata arranca de cero, y el timer
          // de kick vuelve a darle una ventana completa al intento.
          const conn = newConn(from, attempt);
          clearKick(from);
          scheduleKick(from);
          await conn.pc.setRemoteDescription(
            new RTCSessionDescription(data as RTCSessionDescriptionInit),
          );
          conn.remoteSet = true;
          await flushPendingIce(conn);
          const answer = await conn.pc.createAnswer();
          await conn.pc.setLocalDescription(answer);
          sendSignal(from, "answer", answer, attempt);
        } else if (kind === "answer") {
          const conn = conns.get(from);
          // Respuesta de una oferta que ya reemplazamos: se descarta.
          if (!conn || conn.attempt !== attempt || conn.remoteSet) return;
          await conn.pc.setRemoteDescription(
            new RTCSessionDescription(data as RTCSessionDescriptionInit),
          );
          conn.remoteSet = true;
          await flushPendingIce(conn);
        } else if (kind === "ice") {
          const conn = conns.get(from);
          if (!conn || conn.attempt !== attempt) return;
          if (!conn.remoteSet) {
            // Llegó antes que la oferta/respuesta terminara de aplicarse:
            // se encola en vez de perderse (esto dejaba pares mudos).
            conn.pendingIce.push(data as RTCIceCandidateInit);
            return;
          }
          try {
            await conn.pc.addIceCandidate(
              new RTCIceCandidate(data as RTCIceCandidateInit),
            );
          } catch {
            // candidato duplicado/inválido: no importa.
          }
        } else if (kind === "kick") {
          // Al otro no le llegó nuestra oferta (o quedó colgado): va otra.
          if (iOffer(from) && conns.get(from)?.pc.connectionState !== "connected") {
            void offerTo(from);
          }
        }
      } catch {
        // Señal vieja/duplicada que dejó la pc en un estado que no la acepta:
        // se ignora, los reintentos numerados la reemplazan.
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const ids = Object.keys(state).filter((id) => id !== sessionId);

      setPeers((prev) =>
        ids.map((id) => {
          const meta = state[id]?.[0];
          const existing = prev.find((p) => p.id === id);
          return {
            id,
            nickname: meta?.nickname ?? "Jugador",
            avatarUrl: meta?.avatarUrl ?? null,
            state:
              existing?.state ??
              (conns.get(id)?.pc.connectionState === "connected"
                ? "connected"
                : "connecting"),
          };
        }),
      );

      for (const id of ids) {
        if (conns.has(id)) continue;
        if (iOffer(id)) void offerTo(id);
        else scheduleKick(id);
      }
      for (const id of [...conns.keys()]) {
        if (!ids.includes(id)) {
          dropConn(id);
          offerCount.delete(id);
          kickCount.delete(id);
        }
      }
      for (const id of [...kickTimers.keys()]) {
        if (!ids.includes(id)) clearKick(id);
      }
    });

    // Celular que vuelve del background: reintentamos todo lo no conectado
    // con contadores en cero (el handshake pudo morir mientras dormía).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      for (const id of Object.keys(channel.presenceState())) {
        if (id === sessionId) continue;
        if (conns.get(id)?.pc.connectionState === "connected") continue;
        offerCount.set(id, 0);
        kickCount.set(id, 0);
        if (iOffer(id)) {
          void offerTo(id);
        } else {
          sendSignal(id, "kick");
          scheduleKick(id);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    teardownRef.current = () => {
      document.removeEventListener("visibilitychange", onVisible);
      kickTimers.forEach((t) => clearTimeout(t));
      kickTimers.clear();
    };

    channel.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        channel
          .track({
            userId: me.id,
            nickname: me.nickname,
            avatarUrl: me.avatarUrl,
          } satisfies PresenceMeta)
          .then(() => setStatus("joined"))
          .catch(() => {});
      }
    });
  }, [channelKey, me.id, me.nickname, me.avatarUrl]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current
        ?.getAudioTracks()
        .forEach((t) => (t.enabled = !next));
      return next;
    });
  };

  const inVoice = status === "joined";
  const total = peers.length + (inVoice ? 1 : 0);

  const PEER_RING: Record<PeerState, string> = {
    connected: "ring-grass",
    connecting: "ring-ink/20",
    failed: "ring-cardred/60",
  };
  const peerLabel = (p: Peer) =>
    p.state === "connected"
      ? p.nickname
      : p.state === "failed"
        ? "sin señal"
        : "conectando…";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 text-ink shadow-card ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink/50">
          🎙️ Voz de la sala
        </span>
        {inVoice && (
          <span className="rounded-full bg-grass/15 px-2 py-0.5 text-[11px] font-bold text-grass">
            {total} en la voz
          </span>
        )}
      </div>

      {inVoice ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* Vos */}
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "inline-flex rounded-full ring-2",
                  muted ? "ring-cardred/60" : "ring-grass",
                )}
              >
                <Avatar
                  src={me.avatarUrl}
                  name={me.nickname}
                  className="size-10 text-sm"
                />
              </span>
              <span className="text-[11px] font-semibold text-ink/70">
                {muted ? "🔇 vos" : "vos"}
              </span>
            </div>

            {peers.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "inline-flex rounded-full ring-2",
                    PEER_RING[p.state],
                    p.state === "failed" && "opacity-60",
                  )}
                >
                  <Avatar
                    src={p.avatarUrl}
                    name={p.nickname}
                    className="size-10 text-sm"
                  />
                </span>
                <span
                  className={cn(
                    "max-w-[4.5rem] truncate text-[11px] font-semibold",
                    p.state === "failed" ? "text-cardred" : "text-ink/70",
                  )}
                >
                  {peerLabel(p)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95",
                muted
                  ? "bg-cardred text-cream"
                  : "bg-ink/10 text-ink hover:bg-ink/15",
              )}
            >
              {muted ? "🔇 Silenciado" : "🎙️ Micrófono abierto"}
            </button>
            <button
              type="button"
              onClick={leave}
              className="shrink-0 rounded-full bg-ink/10 px-4 py-2 text-sm font-bold text-ink transition hover:bg-ink/15 active:scale-95"
            >
              Salir
            </button>
          </div>

          {Object.entries(remoteStreams).map(([id, stream]) => (
            <PeerAudio key={id} stream={stream} />
          ))}
        </>
      ) : (
        <>
          <p className="text-[13px] text-ink/60">
            Metete a la voz y bancá el partido hablando con los que estén en la
            sala. Micrófono abierto, podés mutear cuando quieras.
          </p>
          <button
            type="button"
            onClick={join}
            disabled={status === "connecting"}
            className="rounded-full bg-pitch px-4 py-2 text-sm font-bold text-cream transition active:scale-95 disabled:opacity-50"
          >
            {status === "connecting" ? "Conectando…" : "🎙️ Entrar a la voz"}
          </button>
          {error && (
            <p className="text-xs font-semibold text-cardred">{error}</p>
          )}
        </>
      )}
    </div>
  );
}
