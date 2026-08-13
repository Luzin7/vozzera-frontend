import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [micEnabled, setMicEnabledState] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<LiveKitRoom | null>(null);

  const syncParticipants = useCallback((room: LiveKitRoom) => {
    const remotes = Array.from(room.remoteParticipants.values()).map((p) => p.name || p.identity);
    const me = room.localParticipant.name || room.localParticipant.identity;
    setParticipants([me, ...remotes]);
  }, []);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    setParticipants([]);
  }, []);

  const connect = useCallback(
    async (roomId: string) => {
      if (roomRef.current) await disconnect();

      setError(null);
      setStatus("connecting");
      setActiveRoomId(roomId);

      try {
        // import dinâmico: livekit-client é browser-only e o app faz SSR
        const { Room, RoomEvent, Track } = await import("livekit-client");

        const { token, url } = await api<VoiceTokenResponse>("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId }),
        });

        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.style.display = "none";
          document.body.appendChild(el);
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room));
        room.on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setStatus("idle");
          setActiveRoomId(null);
          setParticipants([]);
        });

        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(true);

        setMicEnabledState(true);
        setStatus("connected");
        setActiveRoomId(roomId);
        syncParticipants(room);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não consegui entrar no canal");
        setStatus("idle");
        setActiveRoomId(null);
        setParticipants([]);
        roomRef.current = null;
      }
    },
    [disconnect, syncParticipants],
  );

  const setMicEnabled = useCallback(async (enabled: boolean) => {
    await roomRef.current?.localParticipant.setMicrophoneEnabled(enabled);
    setMicEnabledState(enabled);
  }, []);

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  return {
    status,
    activeRoomId,
    participants,
    micEnabled,
    error,
    clearError: useCallback(() => setError(null), []),
    connect,
    disconnect,
    setMicEnabled,
  };
}
