import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type LocalVideoTrack = import("livekit-client").LocalVideoTrack;
type RemoteVideoTrack = import("livekit-client").RemoteVideoTrack;
type ScreenShareCaptureOptions = import("livekit-client").ScreenShareCaptureOptions;

export type ScreenShareTrack = LocalVideoTrack | RemoteVideoTrack;

export type ScreenShare = {
  id: string;
  name: string;
  track: ScreenShareTrack;
};

export type ScreenShareQuality = {
  width: number;
  height: number;
  frameRate: number;
};

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [micEnabled, setMicEnabledState] = useState(true);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [screenShareEnabled, setScreenShareEnabledState] = useState(false);
  const [screenShares, setScreenShares] = useState<ScreenShare[]>([]);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);
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
    setLocalPreview(null);
  }, []);

  const setScreenShare = useCallback(async (enabled: boolean, quality?: ScreenShareQuality) => {
    const room = roomRef.current;
    if (!room) return;

    if (!enabled) {
      await room.localParticipant.setScreenShareEnabled(false);
      setScreenShareEnabledState(false);
      setLocalPreview(null);
      return;
    }

    const options: ScreenShareCaptureOptions | undefined = quality
      ? {
          resolution: {
            width: quality.width,
            height: quality.height,
            frameRate: quality.frameRate,
          },
        }
      : undefined;

    const publication = await room.localParticipant.setScreenShareEnabled(true, options);
    const track = publication?.videoTrack;
    const name = room.localParticipant.name || room.localParticipant.identity;

    setScreenShareEnabledState(true);
    setLocalPreview(track ? { id: "local", name, track } : null);
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

        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.track?.source !== Track.Source.ScreenShare) return;

          setScreenShareEnabledState(false);
          setLocalPreview(null);
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
          setLocalPreview(null);
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
    localPreview,
    error,
    clearError: useCallback(() => setError(null), []),
    connect,
    disconnect,
    setMicEnabled,
    setParticipantVolume,
    setScreenShare,
  };
}
