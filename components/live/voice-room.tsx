"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

/**
 * Chat de voz de la sala en vivo, sin apps ni servidores externos: WebRTC
 * navegador-a-navegador en malla (mesh). La señalización (offer/answer/ICE)
 * viaja por un canal `broadcast` de Supabase Realtime, y presence nos dice
 * quién está en la voz. Micrófono abierto (con cancelación de eco/ruido) y
 * botón de mutear. STUN público de Google; sin TURN por ahora.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type SignalKind = "offer" | "answer" | "ice";

interface SignalPayload {
  from: string;
  to: string;
  kind: SignalKind;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

interface PresenceMeta {
  nickname?: string;
  avatarUrl?: string | null;
}

interface Peer {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  connected: boolean;
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
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const leave = useCallback(() => {
    pcsRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    pcsRef.current.clear();
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

  // Al desmontar (navegar fuera de la sala) cortamos todo.
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

    const supabase = createClient();
    const channel = supabase.channel(`voice:${channelKey}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    channelRef.current = channel;
    const pcs = pcsRef.current;

    const sendSignal = (
      to: string,
      kind: SignalKind,
      data: SignalPayload["data"],
    ) => {
      channel.send({
        type: "broadcast",
        event: "signal",
        payload: { from: me.id, to, kind, data } satisfies SignalPayload,
      });
    };

    const createPeer = (peerId: string) => {
      const existing = pcs.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(peerId, "ice", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        const [remote] = e.streams;
        if (remote) setRemoteStreams((prev) => ({ ...prev, [peerId]: remote }));
      };
      pc.onconnectionstatechange = () => {
        const connected = pc.connectionState === "connected";
        setPeers((prev) =>
          prev.map((p) => (p.id === peerId ? { ...p, connected } : p)),
        );
      };

      pcs.set(peerId, pc);
      return pc;
    };

    // Regla determinística para evitar que ambos ofrezcan a la vez (glare):
    // ofrece siempre el del id más chico; el otro espera y responde.
    const connectToPeer = async (peerId: string) => {
      const pc = createPeer(peerId);
      if (me.id < peerId) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignal(peerId, "offer", offer);
      }
    };

    const closePeer = (peerId: string) => {
      const pc = pcs.get(peerId);
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pcs.delete(peerId);
      }
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    channel.on(
      "broadcast",
      { event: "signal" },
      async (msg) => {
        const payload = msg.payload as SignalPayload;
        if (payload.to !== me.id) return;
        const { from, kind, data } = payload;

        if (kind === "offer") {
          const pc = createPeer(from);
          await pc.setRemoteDescription(
            new RTCSessionDescription(data as RTCSessionDescriptionInit),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal(from, "answer", answer);
        } else if (kind === "answer") {
          const pc = pcs.get(from);
          if (pc) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(data as RTCSessionDescriptionInit),
            );
          }
        } else if (kind === "ice") {
          const pc = pcs.get(from);
          if (pc) {
            try {
              await pc.addIceCandidate(
                new RTCIceCandidate(data as RTCIceCandidateInit),
              );
            } catch {
              // candidato tardío/duplicado: lo ignoramos.
            }
          }
        }
      },
    );

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMeta>();
      const ids = Object.keys(state).filter((id) => id !== me.id);

      setPeers(
        ids.map((id) => {
          const meta = state[id]?.[0];
          return {
            id,
            nickname: meta?.nickname ?? "Jugador",
            avatarUrl: meta?.avatarUrl ?? null,
            connected: pcs.get(id)?.connectionState === "connected",
          };
        }),
      );

      for (const id of ids) if (!pcs.has(id)) void connectToPeer(id);
      for (const id of [...pcs.keys()]) if (!ids.includes(id)) closePeer(id);
    });

    channel.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") {
        channel
          .track({ nickname: me.nickname, avatarUrl: me.avatarUrl })
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
                    p.connected ? "ring-grass" : "ring-ink/20",
                  )}
                >
                  <Avatar
                    src={p.avatarUrl}
                    name={p.nickname}
                    className="size-10 text-sm"
                  />
                </span>
                <span className="max-w-[4.5rem] truncate text-[11px] font-semibold text-ink/70">
                  {p.connected ? p.nickname : "conectando…"}
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
