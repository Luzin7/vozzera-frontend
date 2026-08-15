import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type RemoteVideoTrack = import("livekit-client").RemoteVideoTrack;

export type ScreenShare = {
  id: string;
  name: string;
  track: RemoteVideoTrack;
};

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [micEnabled, setMicEnabledState] = useState(true);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [screenShareEnabled, setScreenShareEnabledState] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const volumesRef = useRef<Record<string, number>>({});

  const syncParticipants = useCallback((room: LiveKitRoom) => {
    const remotes = Array.from(room.remoteParticipants.values()).map((p) => p.name || p.identity);
    const me = room.localParticipant.name || room.localParticipant.identity;
    setParticipants([me, ...remotes]);

    for (const p of room.remoteParticipants.values()) {
      const name = p.name || p.identity;
      const volume = volumesRef.current[name];
      if (volume !== undefined) p.setVolume(volume);
    }
  }, []);

  const setParticipantVolume = useCallback((name: string, volume: number) => {
    volumesRef.current[name] = volume;
    setVolumes((prev) => ({ ...prev, [name]: volume }));

    const participant = Array.from(roomRef.current?.remoteParticipants.values() ?? []).find(
      (p) => (p.name || p.identity) === name,
    );
    if (participant) {
      participant.setVolume(volume);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    setParticipants([]);
    setScreenShareEnabledState(false);
    setScreenShares([]);
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const next = !room.localParticipant.isScreenShareEnabled;
    await room.localParticipant.setScreenShareEnabled(next);
    setScreenShareEnabledState(next);
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

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);
            return;
          }

          if (track.source === Track.Source.ScreenShare) {
            const name = participant.name || participant.identity;
            setScreenShares((prev) => [
              ...prev.filter((share) => share.track !== track),
              { id: publication.trackSid, name, track: track as RemoteVideoTrack },
            ]);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());

          setScreenShares((prev) => prev.filter((share) => share.track !== track));
        });

        room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room));
        room.on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setStatus("idle");
          setActiveRoomId(null);
          setParticipants([]);
          setScreenShareEnabledState(false);
          setScreenShares([]);
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
    volumes,
    screenShareEnabled,
    screenShares,
    error,
    clearError: useCallback(() => setError(null), []),
    connect,
    disconnect,
    setMicEnabled,
    setParticipantVolume,
    toggleScreenShare,
  };
}
