import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "./api";
import type { VoiceTokenResponse } from "./types";
import {
  audioCaptureOptions,
  audioInputDevices,
  isLocalVoiceActive,
  mergeActiveSpeakerNames,
  muteVolume,
  microphonePublishOptions,
  readMicDeviceId,
  readNoiseFilter,
  readParticipantVolumes,
  readScreenShareVolumes,
  screenShareAudioCaptureOptions,
  screenSharePublishOptions,
  shouldShowLocalVoiceActivity,
  VOICE_RELEASE_DELAY_MS,
  writeMicDeviceId,
  writeNoiseFilter,
  writeParticipantVolumes,
  writeScreenShareVolumes,
} from "./voice";
import type { MicDevice, ScreenShareQuality } from "./voice";
import {
  canNotify,
  initialNotificationsEnabled,
  playMessageSound,
  readSoundEnabled,
} from "./notifications";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type RemoteParticipant = import("livekit-client").RemoteParticipant;
type LocalVideoTrack = import("livekit-client").LocalVideoTrack;
type RemoteVideoTrack = import("livekit-client").RemoteVideoTrack;
type LocalAudioTrack = import("livekit-client").LocalAudioTrack;
type TrackSource = import("livekit-client").Track.Source;
type ScreenShareCaptureOptions = import("livekit-client").ScreenShareCaptureOptions;
type TrackPublishOptions = import("livekit-client").TrackPublishOptions;
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

let deafenVolumeActive = false;

function setRemoteParticipantVolume(participant: RemoteParticipant, volume: number) {
  participant.setVolume(deafenVolumeActive ? 0 : volume);
}

function setRemoteParticipantScreenShareVolume(participant: RemoteParticipant, volume: number) {
  if (screenShareAudioSource === null) return;
  participant.setVolume(
    deafenVolumeActive ? 0 : volume,
    screenShareAudioSource as Parameters<RemoteParticipant["setVolume"]>[1],
  );
}

export type { ScreenShareQuality } from "./voice";

let screenShareAudioSource: unknown = null;

function createVoiceAudioContext(): AudioContext {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AudioContextConstructor();
}

async function loadLiveKitClient() {
  const client = await import("livekit-client");
  screenShareAudioSource = client.Track.Source.ScreenShareAudio;
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
  const [screenShareVolumes, setScreenShareVolumes] = useState<Record<string, number>>(() => {
    if (typeof localStorage === "undefined") return {};
    return readScreenShareVolumes(localStorage);
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
  const [krispSupported, setKrispSupported] = useState<boolean | null>(null);
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [mutedParticipants, setMutedParticipants] = useState<Record<string, boolean>>({});
  const [screenShareMutedParticipants, setScreenShareMutedParticipants] = useState<
    Record<string, boolean>
  >({});
  const [serverSpeakingNames, setServerSpeakingNames] = useState<string[]>([]);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [localMicTrack, setLocalMicTrack] = useState<LocalAudioTrack | null>(null);
  const [micProcessorRevision, setMicProcessorRevision] = useState(0);
  const [localPreview, setLocalPreview] = useState<ScreenShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deafen, setDeafen] = useState(false);
  const savedDeafenMicRef = useRef(false);
  const screenShareRef = useRef(false);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const connectionAttemptRef = useRef(0);
  const serverSpeakingNamesRef = useRef<string[]>([]);
  const speakerReleaseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const volumesRef = useRef(volumes);
  const screenShareVolumesRef = useRef(screenShareVolumes);
  const mutedVolumesRef = useRef<Record<string, number>>({});
  const screenShareMutedVolumesRef = useRef<Record<string, number>>({});
  const noiseFilterRef = useRef(noiseFilter);
  const selectedDeviceIdRef = useRef(selectedDeviceId);
  const micPermissionRef = useRef(false);
  const krispProcessorRef = useRef<KrispNoiseFilterProcessor | null>(null);
  const krispTrackRef = useRef<LocalAudioTrack | null>(null);
  const krispLoadPromiseRef = useRef<Promise<boolean> | null>(null);
  const notificationsEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : initialNotificationsEnabled(localStorage),
  );
  const soundEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : readSoundEnabled(localStorage),
  );

  noiseFilterRef.current = noiseFilter;
  selectedDeviceIdRef.current = selectedDeviceId;
  deafenVolumeActive = deafen;
  screenShareVolumesRef.current = screenShareVolumes;

  const applyParticipantVolumes = useCallback((p: RemoteParticipant) => {
    const name = p.name || p.identity;
    const volume = volumesRef.current[name];
    const ssVolume = screenShareVolumesRef.current[name];
    if (volume === undefined && ssVolume === undefined && deafenVolumeActive) {
      setRemoteParticipantVolume(p, 0);
      setRemoteParticipantScreenShareVolume(p, 0);
      return;
    }
    if (volume !== undefined) setRemoteParticipantVolume(p, volume);
    if (ssVolume !== undefined) setRemoteParticipantScreenShareVolume(p, ssVolume);
  }, []);

  const syncParticipants = useCallback(
    (room: LiveKitRoom) => {
      const remotes = Array.from(room.remoteParticipants.values()).map((p) => p.name || p.identity);
      const me = room.localParticipant.name || room.localParticipant.identity;
      setParticipants([me, ...remotes]);

      for (const p of room.remoteParticipants.values()) applyParticipantVolumes(p);
    },
    [applyParticipantVolumes],
  );

  const removeParticipant = useCallback((name: string) => {
    setMutedParticipants((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setScreenShareMutedParticipants((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    const releaseTimer = speakerReleaseTimersRef.current.get(name);
    if (releaseTimer) clearTimeout(releaseTimer);
    speakerReleaseTimersRef.current.delete(name);
    serverSpeakingNamesRef.current = serverSpeakingNamesRef.current.filter(
      (speaker) => speaker !== name,
    );
    setServerSpeakingNames(serverSpeakingNamesRef.current);
    delete mutedVolumesRef.current[name];
    delete screenShareMutedVolumesRef.current[name];
  }, []);

  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setMutedParticipants({});
    setScreenShareMutedParticipants({});
    setServerSpeakingNames([]);
    setLocalSpeaking(false);
    setLocalMicTrack(null);
    setScreenShareEnabledState(false);
    setScreenShares([]);
    setLocalPreview(null);
    mutedVolumesRef.current = {};
    screenShareMutedVolumesRef.current = {};
    for (const timer of speakerReleaseTimersRef.current.values()) clearTimeout(timer);
    speakerReleaseTimersRef.current.clear();
    serverSpeakingNamesRef.current = [];
    krispProcessorRef.current = null;
    krispTrackRef.current = null;
    screenShareRef.current = false;
  }, []);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    setMicDevices(audioInputDevices(devices));
  }, []);

  const syncLocalMicTrack = useCallback((room: LiveKitRoom) => {
    const publication = room.localParticipant.getTrackPublication("microphone" as TrackSource);
    setLocalMicTrack((publication?.track ?? null) as LocalAudioTrack | null);
  }, []);

  const ensureKrispLoaded = useCallback(() => {
    if (krispLoadPromiseRef.current) return krispLoadPromiseRef.current;

    krispLoadPromiseRef.current = import("@livekit/krisp-noise-filter")
      .then(({ isKrispNoiseFilterSupported }) => {
        const supported = isKrispNoiseFilterSupported();
        setKrispSupported(supported);
        return supported;
      })
      .catch(() => {
        setKrispSupported(false);
        return false;
      });

    return krispLoadPromiseRef.current;
  }, []);

  const createKrispProcessor = useCallback(async () => {
    if (!noiseFilterRef.current) return null;

    const supported = await ensureKrispLoaded();
    if (!supported) return null;

    try {
      const { KrispNoiseFilter } = await import("@livekit/krisp-noise-filter");
      return KrispNoiseFilter();
    } catch {
      setError("Não consegui carregar o filtro de ruído.");
      return null;
    }
  }, [ensureKrispLoaded]);

  const attachKrispNoiseFilter = useCallback(
    async (track: LocalAudioTrack) => {
      if (krispTrackRef.current && krispTrackRef.current !== track) {
        await krispTrackRef.current.stopProcessor().catch(() => undefined);
        krispProcessorRef.current = null;
        krispTrackRef.current = null;
      }

      if (!noiseFilterRef.current) return;

      const supported = await ensureKrispLoaded();
      if (!supported) return;

      if (krispProcessorRef.current) {
        try {
          await krispProcessorRef.current.setEnabled(true);
          setMicProcessorRevision((revision) => revision + 1);
        } catch {
          setError("Não consegui ativar o filtro de ruído.");
        }
        return;
      }

      try {
        const { KrispNoiseFilter } = await import("@livekit/krisp-noise-filter");
        const processor = KrispNoiseFilter();
        await track.setProcessor(processor as AudioTrackProcessor);
        krispProcessorRef.current = processor;
        krispTrackRef.current = track;
        await processor.setEnabled(true);
        setMicProcessorRevision((revision) => revision + 1);
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

  const setScreenShareVolume = useCallback((name: string, volume: number) => {
    const next = { ...screenShareVolumesRef.current, [name]: volume };
    screenShareVolumesRef.current = next;
    setScreenShareVolumes(next);
    writeScreenShareVolumes(typeof localStorage === "undefined" ? null : localStorage, next);

    const participant = Array.from(roomRef.current?.remoteParticipants.values() ?? []).find(
      (p) => (p.name || p.identity) === name,
    );
    if (participant) setRemoteParticipantScreenShareVolume(participant, volume);
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

  const setLocalScreenShareMute = useCallback(
    (name: string, muted: boolean) => {
      const current = screenShareVolumesRef.current[name];

      if (muted) {
        screenShareMutedVolumesRef.current[name] = current ?? 1;
        setScreenShareVolume(name, muteVolume(true, undefined));
        setScreenShareMutedParticipants((prev) => ({ ...prev, [name]: true }));
        return;
      }

      const previous = screenShareMutedVolumesRef.current[name];
      delete screenShareMutedVolumesRef.current[name];
      setScreenShareVolume(name, muteVolume(false, previous));
      setScreenShareMutedParticipants((prev) => ({ ...prev, [name]: false }));
    },
    [setScreenShareVolume],
  );

  const toggleLocalScreenShareMute = useCallback(
    (name: string) => {
      setLocalScreenShareMute(name, screenShareVolumesRef.current[name] !== 0);
    },
    [setLocalScreenShareMute],
  );

  const closeVoiceAudioContext = useCallback(async (context?: AudioContext | null) => {
    const contextToClose = context === undefined ? voiceAudioContextRef.current : context;
    if (voiceAudioContextRef.current === contextToClose) voiceAudioContextRef.current = null;
    const audioContext = contextToClose;
    if (!audioContext || audioContext.state === "closed") return;
    await audioContext.close().catch(() => undefined);
  }, []);

  const disconnect = useCallback(async () => {
    connectionAttemptRef.current += 1;
    await roomRef.current?.disconnect();
    await closeVoiceAudioContext();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    resetRoomState();
  }, [closeVoiceAudioContext, resetRoomState]);

  const setScreenShare = useCallback(async (enabled: boolean, quality?: ScreenShareQuality) => {
    const room = roomRef.current;
    if (!room) return;

    if (!enabled) {
      await room.localParticipant.setScreenShareEnabled(false);
      setScreenShareEnabledState(false);
      setLocalPreview(null);
      screenShareRef.current = false;
      return;
    }

    const options: ScreenShareCaptureOptions = quality
      ? {
          audio: screenShareAudioCaptureOptions(),
          resolution: {
            width: quality.width,
            height: quality.height,
            frameRate: quality.frameRate,
          },
        }
      : { audio: screenShareAudioCaptureOptions() };

    const publishQuality = quality ?? { width: 1920, height: 1080, frameRate: 30 };
    const publishOptions = screenSharePublishOptions(publishQuality) as TrackPublishOptions;
    const publication = await room.localParticipant.setScreenShareEnabled(
      true,
      options,
      publishOptions,
    );
    const track = publication?.videoTrack;
    const name = room.localParticipant.name || room.localParticipant.identity;

    setScreenShareEnabledState(true);
    setLocalPreview(track ? { id: "local", name, track } : null);
    screenShareRef.current = true;
  }, []);

  const syncActiveSpeakerNames = useCallback((activeNames: string[]) => {
    const activeNameSet = new Set(activeNames);

    for (const name of activeNames) {
      const releaseTimer = speakerReleaseTimersRef.current.get(name);
      if (releaseTimer) clearTimeout(releaseTimer);
      speakerReleaseTimersRef.current.delete(name);
    }

    for (const name of serverSpeakingNamesRef.current) {
      if (activeNameSet.has(name)) continue;
      if (speakerReleaseTimersRef.current.has(name)) continue;

      const releaseTimer = setTimeout(() => {
        speakerReleaseTimersRef.current.delete(name);
        serverSpeakingNamesRef.current = serverSpeakingNamesRef.current.filter(
          (speaker) => speaker !== name,
        );
        setServerSpeakingNames(serverSpeakingNamesRef.current);
      }, VOICE_RELEASE_DELAY_MS);
      speakerReleaseTimersRef.current.set(name, releaseTimer);
    }

    serverSpeakingNamesRef.current = mergeActiveSpeakerNames(
      serverSpeakingNamesRef.current,
      activeNames,
    );
    setServerSpeakingNames(serverSpeakingNamesRef.current);
  }, []);

  const connect = useCallback(
    async (roomId: string) => {
      if (roomRef.current) await disconnect();
      const attemptId = connectionAttemptRef.current + 1;
      connectionAttemptRef.current = attemptId;

      setError(null);
      setStatus("connecting");
      setActiveRoomId(roomId);
      let preparedMicTrack: LocalAudioTrack | null = null;
      let attemptAudioContext: AudioContext | null = null;
      let connectingRoom: LiveKitRoom | null = null;

      try {
        const [client, tokenResponse, initialProcessor] = await Promise.all([
          loadLiveKitClient(),
          api<VoiceTokenResponse>("/api/voice/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room_id: roomId }),
          }),
          createKrispProcessor(),
        ]);
        if (connectionAttemptRef.current !== attemptId) return;
        const { Room, RoomEvent, Track, VideoQuality } = client;
        const { token, url } = tokenResponse;

        const voiceAudioContext = createVoiceAudioContext();
        attemptAudioContext = voiceAudioContext;
        voiceAudioContextRef.current = voiceAudioContext;
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          webAudioMix: { audioContext: voiceAudioContext },
        });
        connectingRoom = room;
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.style.display = "none";
            document.body.appendChild(el);

            if (participant.isLocal) return;

            const name = participant.name || participant.identity;
            if (publication.source === Track.Source.Microphone) {
              setMutedParticipants((prev) => ({ ...prev, [name]: publication.isMuted }));
            }
            applyParticipantVolumes(participant);
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
          const localName = room.localParticipant.name || room.localParticipant.identity;
          const activeNames = speakers
            .map((p) => p.name || p.identity)
            .filter((name) => {
              if (name !== localName) return true;
              return !screenShareRef.current;
            });
          syncActiveSpeakerNames(activeNames);
        });

        room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.track?.source !== Track.Source.ScreenShare) return;

          setScreenShareEnabledState(false);
          setLocalPreview(null);
          screenShareRef.current = false;
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          syncParticipants(room);

          const name = participant.name || participant.identity;
          const me = room.localParticipant.name || room.localParticipant.identity;
          if (name === me) return;

          const ssVolume = screenShareVolumesRef.current[name];
          if (ssVolume !== undefined) {
            const remoteParticipant = room.remoteParticipants.get(participant.sid);
            if (remoteParticipant)
              setRemoteParticipantScreenShareVolume(remoteParticipant, ssVolume);
          }

          if (
            typeof document !== "undefined" &&
            canNotify(notificationsEnabledRef.current, document.hidden)
          ) {
            new Notification("Canal de voz", { body: `${name} entrou no canal` });
          }

          if (typeof document !== "undefined" && document.hidden && soundEnabledRef.current) {
            playMessageSound();
          }
        });
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          const name = participant.name || participant.identity;
          removeParticipant(name);
          syncParticipants(room);

          if (
            typeof document !== "undefined" &&
            canNotify(notificationsEnabledRef.current, document.hidden)
          ) {
            new Notification("Canal de voz", { body: `${name} saiu do canal` });
          }
        });
        room.on(RoomEvent.Disconnected, () => {
          void closeVoiceAudioContext(voiceAudioContext);
          if (roomRef.current !== room) return;
          roomRef.current = null;
          setStatus("idle");
          setActiveRoomId(null);
          resetRoomState();
        });

        const [createdTrack] = await room.localParticipant.createTracks({
          audio: audioCaptureOptions(selectedDeviceIdRef.current),
          video: false,
        });
        preparedMicTrack = createdTrack ? (createdTrack as LocalAudioTrack) : null;
        if (!preparedMicTrack) throw new Error("Não consegui preparar o microfone.");
        preparedMicTrack.setAudioContext(voiceAudioContext);

        if (initialProcessor) {
          await preparedMicTrack.setProcessor(initialProcessor as AudioTrackProcessor);
          krispProcessorRef.current = initialProcessor;
          krispTrackRef.current = preparedMicTrack;
          await initialProcessor.setEnabled(true);
          setMicProcessorRevision((revision) => revision + 1);
        }

        if (connectionAttemptRef.current !== attemptId) {
          preparedMicTrack.stop();
          if (roomRef.current === room) roomRef.current = null;
          await closeVoiceAudioContext(voiceAudioContext);
          return;
        }

        await room.connect(url, token);
        if (connectionAttemptRef.current !== attemptId) {
          await room.disconnect();
          preparedMicTrack.stop();
          await closeVoiceAudioContext(voiceAudioContext);
          return;
        }
        await room.localParticipant.publishTrack(
          preparedMicTrack as Parameters<typeof room.localParticipant.publishTrack>[0],
          microphonePublishOptions(),
        );

        setMicEnabledState(true);
        syncLocalMicTrack(room);
        micPermissionRef.current = true;
        setStatus("connected");
        setActiveRoomId(roomId);
        syncParticipants(room);
      } catch (err) {
        if (connectingRoom && roomRef.current === connectingRoom) roomRef.current = null;
        await connectingRoom?.disconnect().catch(() => undefined);
        preparedMicTrack?.stop();
        await closeVoiceAudioContext(attemptAudioContext);
        if (connectionAttemptRef.current !== attemptId) return;
        setError(err instanceof Error ? err.message : "Não consegui entrar no canal");
        setStatus("idle");
        setActiveRoomId(null);
        resetRoomState();
        roomRef.current = null;
      }
    },
    [
      applyParticipantVolumes,
      closeVoiceAudioContext,
      createKrispProcessor,
      disconnect,
      removeParticipant,
      resetRoomState,
      syncActiveSpeakerNames,
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

      await participant.setMicrophoneEnabled(enabled, options, microphonePublishOptions());
      const track = participant.getTrackPublication("microphone" as TrackSource)?.track as
        LocalAudioTrack | undefined;
      if (enabled && track) await attachKrispNoiseFilter(track);
      syncLocalMicTrack(room);
      setMicEnabledState(enabled);
    },
    [attachKrispNoiseFilter, syncLocalMicTrack],
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

      const track = roomRef.current?.localParticipant.getTrackPublication(
        "microphone" as TrackSource,
      )?.track as LocalAudioTrack | undefined;
      const processor = krispProcessorRef.current;
      if (processor && krispTrackRef.current === track) {
        await applyKrispToggle(processor, enabled, setError);
        setMicProcessorRevision((revision) => revision + 1);
        return;
      }

      if (!enabled) return;
      if (!track) return;
      await attachKrispNoiseFilter(track);
    },
    [attachKrispNoiseFilter, setError],
  );

  const toggleDeafen = useCallback(() => {
    if (deafen) {
      if (savedDeafenMicRef.current) void setMicEnabled(true);
      setDeafen(false);
      return;
    }
    savedDeafenMicRef.current = micEnabled;
    void setMicEnabled(false);
    setDeafen(true);
  }, [deafen, micEnabled, setMicEnabled]);

  useEffect(() => {
    if (status !== "connected") return;
    const room = roomRef.current;
    if (!room) return;

    for (const p of room.remoteParticipants.values()) applyParticipantVolumes(p);
  }, [deafen, status, applyParticipantVolumes]);

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
    if (status !== "connected" || !micEnabled || !localMicTrack) {
      setLocalSpeaking(false);
      return;
    }

    let cancelled = false;
    let animationFrame = 0;
    let cleanupAnalyser: (() => Promise<void>) | null = null;
    let active = false;
    let silenceStartedAt: number | null = null;

    void import("livekit-client")
      .then(({ createAudioAnalyser }) => {
        if (cancelled) return;

        const analyser = createAudioAnalyser(localMicTrack, {
          fftSize: 256,
          smoothingTimeConstant: 0.15,
          minDecibels: -75,
          maxDecibels: -25,
        });
        cleanupAnalyser = analyser.cleanup;

        const readVolume = (timestamp: number) => {
          if (cancelled) return;
          const hasVoiceLevel = isLocalVoiceActive(analyser.calculateVolume(), active);
          if (hasVoiceLevel) silenceStartedAt = null;
          if (!hasVoiceLevel && silenceStartedAt === null) silenceStartedAt = timestamp;
          const silenceDuration = silenceStartedAt === null ? 0 : timestamp - silenceStartedAt;
          const nextActive = shouldShowLocalVoiceActivity(hasVoiceLevel, active, silenceDuration);
          if (nextActive !== active) {
            active = nextActive;
            setLocalSpeaking(nextActive);
          }
          animationFrame = requestAnimationFrame(readVolume);
        };

        animationFrame = requestAnimationFrame(readVolume);
      })
      .catch(() => {
        if (!cancelled) setLocalSpeaking(false);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      setLocalSpeaking(false);
      if (cleanupAnalyser) void cleanupAnalyser();
    };
  }, [localMicTrack, micEnabled, micProcessorRevision, status]);

  useEffect(() => {
    return () => {
      connectionAttemptRef.current += 1;
      void roomRef.current?.disconnect();
      void closeVoiceAudioContext();
      roomRef.current = null;
    };
  }, [closeVoiceAudioContext]);

  const [isTabHidden, setIsTabHidden] = useState(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const localName = participants[0];
  const speakingNames =
    localSpeaking && localName
      ? Array.from(new Set([...serverSpeakingNames, localName]))
      : serverSpeakingNames;

  return {
    status,
    activeRoomId,
    participants,
    micEnabled,
    volumes,
    screenShareVolumes,
    screenShareEnabled,
    screenShares,
    micDevices,
    selectedDeviceId,
    noiseFilter,
    krispSupported,
    selfMonitor,
    mutedParticipants,
    screenShareMutedParticipants,
    speakingNames,
    localPreview,
    isTabHidden,
    deafen,
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
    setScreenShareVolume,
    setLocalMute,
    toggleLocalMute,
    setLocalScreenShareMute,
    toggleLocalScreenShareMute,
    setScreenShare,
    toggleDeafen,
  };
}
