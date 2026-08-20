import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";
import {
  audioCaptureOptions,
  audioInputDevices,
  muteVolume,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
} from "./voice";
import type { MicDevice } from "./voice";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type RemoteParticipant = import("livekit-client").RemoteParticipant;
type LocalVideoTrack = import("livekit-client").LocalVideoTrack;
type RemoteVideoTrack = import("livekit-client").RemoteVideoTrack;
type LocalAudioTrack = import("livekit-client").LocalAudioTrack;
type AudioTrack = import("livekit-client").Track;
type TrackSource = import("livekit-client").Track.Source;
type ScreenShareCaptureOptions = import("livekit-client").ScreenShareCaptureOptions;
type KrispNoiseFilterProcessor = import("@livekit/krisp-noise-filter").KrispNoiseFilterProcessor;
type AudioTrackProcessor = import("livekit-client").TrackProcessor<
  import("livekit-client").Track.Kind.Audio,
  import("livekit-client").AudioProcessorOptions
>;

export type ScreenShareTrack = LocalVideoTrack | RemoteVideoTrack;

export type ScreenShare = {
  id: string;
  name: string;
  track: ScreenShareTrack;
};

type ParticipantVolumeSource = NonNullable<Parameters<RemoteParticipant["setVolume"]>[1]>;

let screenShareAudioSource: ParticipantVolumeSource | null = null;

function setRemoteParticipantVolume(participant: RemoteParticipant, volume: number) {
  participant.setVolume(volume);
  if (screenShareAudioSource === null) return;
  participant.setVolume(volume, screenShareAudioSource);
}

export type ScreenShareQuality = {
  width: number;
  height: number;
  frameRate: number;
};

async function loadLiveKitClient() {
  const client = await import("livekit-client");
  screenShareAudioSource = client.Track.Source.ScreenShareAudio satisfies ParticipantVolumeSource;
  return client;
}

async function applyKrispToggle(
  processor: KrispNoiseFilterProcessor,
  enabled: boolean,
  onError: (message: string) => void,
): Promise<void> {
  try {
    await processor.setEnabled(enabled);
  } catch {
    onError("Não consegui aplicar o filtro de ruído.");
  }
}

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [micEnabled, setMicEnabledState] = useState(true);
  const [volumes, setVolumes] = useState<Record<string, number>>(() => {
    if (typeof localStorage === "undefined") return {};
    return readParticipantVolumes(localStorage);
  });
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
  const [krispSupported, setKrispSupported] = useState(false);
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [mutedParticipants, setMutedParticipants] = useState<Record<string, boolean>>({});
  const [speakingNames, setSpeakingNames] = useState<string[]>([]);
  const [localMicTrack, setLocalMicTrack] = useState<AudioTrack | null>(null);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const volumesRef = useRef(volumes);
  const mutedVolumesRef = useRef<Record<string, number>>({});
  const noiseFilterRef = useRef(noiseFilter);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const micPermissionRef = useRef(false);
  const krispProcessorRef = useRef<KrispNoiseFilterProcessor | null>(null);
  const krispSupportedRef = useRef(false);
  const krispLoadPromiseRef = useRef<Promise<boolean> | null>(null);

  noiseFilterRef.current = noiseFilter;
  selectedDeviceIdRef.current = selectedDeviceId;

  const syncParticipants = useCallback((room: LiveKitRoom) => {
    const remotes = Array.from(room.remoteParticipants.values()).map((p) => p.name || p.identity);
    const me = room.localParticipant.name || room.localParticipant.identity;
    setParticipants([me, ...remotes]);

    for (const p of room.remoteParticipants.values()) {
      const name = p.name || p.identity;
      const volume = volumesRef.current[name];
      if (volume !== undefined) setRemoteParticipantVolume(p, volume);
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
    krispProcessorRef.current = null;
  }, []);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    setMicDevices(audioInputDevices(devices));
  }, []);

  const syncLocalMicTrack = useCallback((room: LiveKitRoom) => {
    const publication = room.localParticipant.getTrackPublication("microphone" as TrackSource);
    setLocalMicTrack((publication?.track ?? null) as AudioTrack | null);
  }, []);

  const ensureKrispLoaded = useCallback(() => {
    if (krispLoadPromiseRef.current) return krispLoadPromiseRef.current;

    krispLoadPromiseRef.current = import("@livekit/krisp-noise-filter")
      .then(({ isKrispNoiseFilterSupported }) => {
        const supported = isKrispNoiseFilterSupported();
        krispSupportedRef.current = supported;
        setKrispSupported(supported);
        return supported;
      })
      .catch(() => {
        krispSupportedRef.current = false;
        setKrispSupported(false);
        return false;
      });

    return krispLoadPromiseRef.current;
  }, []);

  const attachKrispNoiseFilter = useCallback(
    async (track: LocalAudioTrack) => {
      if (!noiseFilterRef.current) return;

      const supported = await ensureKrispLoaded();
      if (!supported) return;

      try {
        const { KrispNoiseFilter } = await import("@livekit/krisp-noise-filter");
        const processor = KrispNoiseFilter();
        await track.setProcessor(processor as AudioTrackProcessor);
        krispProcessorRef.current = processor;
        await processor.setEnabled(true);
      } catch {
        setError("Não consegui ativar o filtro de ruído.");
      }
    },
    [ensureKrispLoaded, setError],
  );

  const setParticipantVolume = useCallback((name: string, volume: number) => {
    const next = { ...volumesRef.current, [name]: volume };
    volumesRef.current = next;
    setVolumes(next);
    writeParticipantVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

    const participant = Array.from(roomRef.current?.remoteParticipants.values() ?? []).find(
      (p) => (p.name || p.identity) === name,
    );
    if (participant) setRemoteParticipantVolume(participant, volume);
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

    const options: ScreenShareCaptureOptions = quality
      ? {
          audio: true,
          resolution: {
            width: quality.width,
            height: quality.height,
            frameRate: quality.frameRate,
          },
        }
      : { audio: true };

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
        const { Room, RoomEvent, Track, VideoQuality } = await loadLiveKitClient();

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

        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.source !== Track.Source.Microphone) return;

          const track = publication.track as LocalAudioTrack | undefined;
          if (!track) return;
          void attachKrispNoiseFilter(track);
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
          audioCaptureOptions(selectedDeviceIdRef.current),
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
    [
      attachKrispNoiseFilter,
      disconnect,
      removeParticipant,
      resetRoomState,
      syncLocalMicTrack,
      syncParticipants,
    ],
  );

  const setMicEnabled = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      const participant = room?.localParticipant;
      if (!participant) return;

      const options = enabled ? audioCaptureOptions(selectedDeviceIdRef.current) : undefined;

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
      writeNoiseFilter(typeof localStorage === "undefined" ? null : localStorage, enabled);
      setNoiseFilterState(enabled);

      const processor = krispProcessorRef.current;
      if (processor) {
        await applyKrispToggle(processor, enabled, setError);
        return;
      }

      if (!enabled || !krispSupportedRef.current) return;

      const track = roomRef.current?.localParticipant.getTrackPublication(
        "microphone" as TrackSource,
      )?.track as LocalAudioTrack | undefined;
      if (!track) return;
      await attachKrispNoiseFilter(track);
    },
    [attachKrispNoiseFilter, setError],
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
    krispSupported,
    selfMonitor,
    mutedParticipants,
    speakingNames,
    localPreview,
    isTabHidden,
    error,
    clearError: useCallback(() => setError(null), []),
    ensureKrispLoaded,
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
