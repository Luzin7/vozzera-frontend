import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";
import {
  audioCaptureOptions,
  audioInputDevices,
  muteVolume,
  readMicDeviceId,
  readNoiseFilter,
  writeMicDeviceId,
  writeNoiseFilter,
} from "./voice";
import type { MicDevice } from "./voice";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type LocalVideoTrack = import("livekit-client").LocalVideoTrack;
type RemoteVideoTrack = import("livekit-client").RemoteVideoTrack;
type AudioTrack = import("livekit-client").Track;
type TrackSource = import("livekit-client").Track.Source;
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
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return readMicDeviceId(localStorage);
  });
  const [noiseFilter, setNoiseFilterState] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    return readNoiseFilter(localStorage);
  });
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [mutedParticipants, setMutedParticipants] = useState<Record<string, boolean>>({});
  const [speakingNames, setSpeakingNames] = useState<string[]>([]);
  const [localMicTrack, setLocalMicTrack] = useState<AudioTrack | null>(null);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const volumesRef = useRef<Record<string, number>>({});
  const mutedVolumesRef = useRef<Record<string, number>>({});
  const micEnabledRef = useRef(micEnabled);
  const noiseFilterRef = useRef(noiseFilter);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const micPermissionRef = useRef(false);

  micEnabledRef.current = micEnabled;
  noiseFilterRef.current = noiseFilter;
  selectedDeviceIdRef.current = selectedDeviceId;

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

  const removeParticipant = useCallback((name: string) => {
    setMutedParticipants((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSpeakingNames((prev) => prev.filter((speaker) => speaker !== name));
    delete mutedVolumesRef.current[name];
  }, []);

  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setMutedParticipants({});
    setSpeakingNames([]);
    setLocalMicTrack(null);
    setScreenShareEnabledState(false);
    setScreenShares([]);
    setLocalPreview(null);
    mutedVolumesRef.current = {};
  }, []);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(audioInputDevices(devices));
    } catch {
      // sem permissão de mídia: lista vazia é o esperado até entrar na sala
      setMicDevices([]);
    }
  }, []);

  const syncLocalMicTrack = useCallback((room: LiveKitRoom) => {
    const publication = room.localParticipant.getTrackPublication("microphone" as TrackSource);
    setLocalMicTrack((publication?.track ?? null) as AudioTrack | null);
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

  const setLocalMute = useCallback(
    (name: string, muted: boolean) => {
      const current = volumesRef.current[name];

      if (muted) {
        mutedVolumesRef.current[name] = current ?? 1;
        setParticipantVolume(name, muteVolume(true, undefined));
        return;
      }

      const previous = mutedVolumesRef.current[name];
      delete mutedVolumesRef.current[name];
      setParticipantVolume(name, muteVolume(false, previous));
    },
    [setParticipantVolume],
  );

  const toggleLocalMute = useCallback(
    (name: string) => {
      setLocalMute(name, volumesRef.current[name] !== 0);
    },
    [setLocalMute],
  );

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    resetRoomState();
  }, [resetRoomState]);

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
        const { Room, RoomEvent, Track, VideoQuality } = await import("livekit-client");

        const { token, url } = await api<VoiceTokenResponse>("/api/voice/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId }),
        });

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);

            if (publication.source === Track.Source.Microphone && !participant.isLocal) {
              const name = participant.name || participant.identity;
              setMutedParticipants((prev) => ({ ...prev, [name]: publication.isMuted }));
            }
            return;
          }

          if (track.source === Track.Source.ScreenShare) {
            publication.setVideoQuality(VideoQuality.HIGH);

            const name = participant.name || participant.identity;
            setScreenShares((prev) => [
              ...prev.filter((share) => share.track !== track),
              { id: publication.trackSid, name, track: track as RemoteVideoTrack },
            ]);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());

          setLocalMicTrack((current) => (current === track ? null : current));
          setScreenShares((prev) => prev.filter((share) => share.track !== track));
        });

        room.on(RoomEvent.TrackMuted, (publication, participant) => {
          if (publication.source !== Track.Source.Microphone) return;

          if (participant.isLocal) {
            syncLocalMicTrack(room);
            return;
          }

          const name = participant.name || participant.identity;
          setMutedParticipants((prev) => ({ ...prev, [name]: true }));
        });

        room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
          if (publication.source !== Track.Source.Microphone) return;

          if (participant.isLocal) {
            syncLocalMicTrack(room);
            return;
          }

          const name = participant.name || participant.identity;
          setMutedParticipants((prev) => ({ ...prev, [name]: false }));
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setSpeakingNames(speakers.map((p) => p.name || p.identity));
        });

        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.track?.source !== Track.Source.ScreenShare) return;

          setScreenShareEnabledState(false);
          setLocalPreview(null);
        });

        room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room));
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          removeParticipant(participant.name || participant.identity);
          syncParticipants(room);
        });
        room.on(RoomEvent.Disconnected, () => {
          roomRef.current = null;
          setStatus("idle");
          setActiveRoomId(null);
          resetRoomState();
        });

        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(
          true,
          audioCaptureOptions(noiseFilterRef.current, selectedDeviceIdRef.current),
        );

        setMicEnabledState(true);
        syncLocalMicTrack(room);
        micPermissionRef.current = true;
        setStatus("connected");
        setActiveRoomId(roomId);
        syncParticipants(room);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não consegui entrar no canal");
        setStatus("idle");
        setActiveRoomId(null);
        resetRoomState();
        roomRef.current = null;
      }
    },
    [disconnect, removeParticipant, resetRoomState, syncLocalMicTrack, syncParticipants],
  );

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      const participant = room?.localParticipant;
      if (!participant) return;

      const options = enabled
        ? audioCaptureOptions(noiseFilterRef.current, selectedDeviceIdRef.current)
        : undefined;

      await participant.setMicrophoneEnabled(enabled, options);
      syncLocalMicTrack(room);
      setMicEnabledState(enabled);
    },
    [syncLocalMicTrack],
  );

  const setMicDevice = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.switchActiveDevice("audioinput", deviceId);
      setSelectedDeviceIdState(deviceId);
      writeMicDeviceId(typeof localStorage === "undefined" ? null : localStorage, deviceId);
    } catch {
      setError("Não consegui trocar o microfone.");
    }
  }, []);

  const setNoiseFilter = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      const participant = room?.localParticipant;
      if (!participant) return;

      writeNoiseFilter(typeof localStorage === "undefined" ? null : localStorage, enabled);
      setNoiseFilterState(enabled);

      try {
        const wasEnabled = micEnabledRef.current;

        await participant.setMicrophoneEnabled(false, undefined, { stopMicTrackOnMute: true });

        if (wasEnabled) {
          await participant.setMicrophoneEnabled(
            true,
            audioCaptureOptions(enabled, selectedDeviceIdRef.current),
          );
          setMicEnabledState(true);
          syncLocalMicTrack(room);
        }
      } catch {
        setError("Não consegui aplicar o filtro de ruído.");
      }
    },
    [syncLocalMicTrack],
  );

  useEffect(() => {
    if (status !== "connected" && !micPermissionRef.current) return;

    void refreshMicDevices();
    navigator.mediaDevices?.addEventListener("devicechange", refreshMicDevices);

    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", refreshMicDevices);
    };
  }, [status, refreshMicDevices]);

  useEffect(() => {
    if (!selfMonitor || !localMicTrack) return;

    const element = document.createElement("audio");
    element.autoplay = true;
    element.style.display = "none";
    localMicTrack.attach(element);
    document.body.appendChild(element);

    return () => {
      localMicTrack.detach(element);
      element.remove();
    };
  }, [selfMonitor, localMicTrack]);

  useEffect(() => {
    return () => {
      void roomRef.current?.disconnect();
      roomRef.current = null;
    };
  }, []);

  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    status,
    activeRoomId,
    participants,
    micEnabled,
    volumes,
    screenShareEnabled,
    screenShares,
    micDevices,
    selectedDeviceId,
    noiseFilter,
    selfMonitor,
    mutedParticipants,
    speakingNames,
    localPreview,
    isTabHidden,
    error,
    clearError: useCallback(() => setError(null), []),
    connect,
    disconnect,
    setMicEnabled,
    setMicDevice,
    setNoiseFilter,
    setSelfMonitor,
    setParticipantVolume,
    setLocalMute,
    toggleLocalMute,
    setScreenShare,
  };
}
