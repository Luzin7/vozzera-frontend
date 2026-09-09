import { useCallback, useEffect, useRef, useState } from "react";

import { ConnectionQuality } from "livekit-client";
import { api } from "./api";
import {
  setDeafenVolumeActive,
  setScreenShareAudioSource,
  setRemoteParticipantScreenShareVolume,
  useParticipantVolume,
} from "./use-participant-volume";
import { useScreenShare } from "./use-screen-share";
import type { ScreenShare as ScreenShareType, ScreenShareQuality } from "./use-screen-share";
import { useKrispFilter } from "./use-krisp-filter";
import { useLocalVoiceActivity } from "./use-local-voice-activity";
import type { VoiceTokenResponse } from "./types";
import {
  applyVideoPlaybackDelay,
  audioCaptureOptions,
  audioInputDevices,
  isGlobalMuteActive,
  mergeActiveSpeakerNames,
  microphoneEnabledAfterDeafenToggle,
  microphonePublishOptions,
  participantNamesToMuteForSelectiveListening,
  readMicDeviceId,
  screenShareAdaptiveStreamSettings,
  VIDEO_PLAYBACK_DELAY_MS,
  writeMicDeviceId,
} from "./voice";
import type { MicDevice } from "./voice";
import {
  canNotify,
  initialNotificationsEnabled,
  playMessageSound,
  readSoundEnabled,
} from "./notifications";

export type VoiceStatus = "idle" | "connecting" | "connected";

type LiveKitRoom = import("livekit-client").Room;
type LocalAudioTrack = import("livekit-client").LocalAudioTrack;
type TrackSource = import("livekit-client").Track.Source;

export type { ScreenShareQuality } from "./use-screen-share";

export type ScreenShareTrack = import("./use-screen-share").ScreenShareTrack;

export type ScreenShare = ScreenShareType;

const VOICE_RELEASE_DELAY_MS = 70;

type RoomEventHandlerCtx = {
  room: LiveKitRoom;
  RoomEvent: typeof import("livekit-client").RoomEvent;
  Track: typeof import("livekit-client").Track;
  soundEnabledRef: { readonly current: boolean };
  notificationsEnabledRef: { readonly current: boolean };
  roomRef: { current: LiveKitRoom | null };
  screenShareRef: { current: boolean };
  setRemoteMuted: (name: string, muted: boolean) => void;
  applyParticipantVolumes: (p: import("livekit-client").RemoteParticipant) => void;
  onTrackSubscribed: (
    track: import("livekit-client").Track,
    publication: import("livekit-client").TrackPublication,
    participant: import("livekit-client").Participant,
  ) => void;
  onTrackUnsubscribed: (track: import("livekit-client").Track) => void;
  onLocalTrackUnpublished: (publication: import("livekit-client").LocalTrackPublication) => void;
  syncLocalMicTrack: (room: LiveKitRoom) => void;
  syncActiveSpeakerNames: (names: string[]) => void;
  setLocalQuality: (q: ConnectionQuality) => void;
  setRemoteQualities: React.Dispatch<React.SetStateAction<Record<string, ConnectionQuality>>>;
  syncParticipants: (room: LiveKitRoom) => void;
  removeParticipant: (name: string) => void;
  getScreenShareVolumeRef: () => Record<string, number>;
  closeVoiceAudioContext: (ctx?: AudioContext | null) => Promise<void>;
  resetRoomState: () => void;
  setStatus: (s: VoiceStatus) => void;
  setActiveRoomId: (id: string | null) => void;
};

function setupRoomHandlers(ctx: RoomEventHandlerCtx): void {
  const {
    room,
    RoomEvent,
    Track,
    soundEnabledRef,
    notificationsEnabledRef,
    roomRef,
    screenShareRef,
    setRemoteMuted,
    applyParticipantVolumes,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    syncLocalMicTrack,
    syncActiveSpeakerNames,
    setLocalQuality,
    setRemoteQualities,
    syncParticipants,
    removeParticipant,
    getScreenShareVolumeRef,
    closeVoiceAudioContext,
    resetRoomState,
    setStatus,
    setActiveRoomId,
  } = ctx;

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind !== Track.Kind.Audio) {
      onTrackSubscribed(track, publication, participant);
      return;
    }

    const el = track.attach();
    el.style.display = "none";
    document.body.appendChild(el);

    if (participant.isLocal) return;

    const name = participant.name || participant.identity;
    if (publication.source === Track.Source.Microphone) {
      setRemoteMuted(name, publication.isMuted);
    }
    if (publication.source === Track.Source.ScreenShareAudio) {
      applyVideoPlaybackDelay(track, VIDEO_PLAYBACK_DELAY_MS);
    }
    applyParticipantVolumes(participant);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.source !== Track.Source.ScreenShare) {
      track.detach().forEach((el) => el.remove());
      return;
    }
    onTrackUnsubscribed(track);
  });

  room.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (publication.source !== Track.Source.Microphone) return;

    if (participant.isLocal) {
      syncLocalMicTrack(room);
      return;
    }

    const name = participant.name || participant.identity;
    setRemoteMuted(name, true);
  });

  room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (publication.source !== Track.Source.Microphone) return;

    if (participant.isLocal) {
      syncLocalMicTrack(room);
      return;
    }

    const name = participant.name || participant.identity;
    setRemoteMuted(name, false);
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

  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    const name = participant.name || participant.identity;
    if (participant.isLocal) {
      setLocalQuality(quality);
      return;
    }
    setRemoteQualities((prev) => ({ ...prev, [name]: quality }));
  });

  room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
    onLocalTrackUnpublished(publication);
  });

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    syncParticipants(room);

    const name = participant.name || participant.identity;
    const me = room.localParticipant.name || room.localParticipant.identity;
    if (name === me) return;

    const ssVolume = getScreenShareVolumeRef()[name];
    if (ssVolume !== undefined) {
      const remoteParticipant = room.remoteParticipants.get(participant.sid);
      if (remoteParticipant) setRemoteParticipantScreenShareVolume(remoteParticipant, ssVolume);
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
    void closeVoiceAudioContext();
    if (roomRef.current !== room) return;
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    resetRoomState();
  });
}

export function useVoice() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [micDevices, setMicDevices] = useState<MicDevice[]>([]);
  const [selectedMic, setSelectedMic] = useState<string | null>(() => {
    if (typeof localStorage === "undefined") return null;
    return readMicDeviceId(localStorage);
  });
  const [selfMonitor, setSelfMonitor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deafen, setDeafen] = useState(false);
  const [localMicTrack, setLocalMicTrack] = useState<LocalAudioTrack | null>(null);
  const [localQuality, setLocalQuality] = useState(ConnectionQuality.Excellent);
  const [remoteQualities, setRemoteQualities] = useState<Record<string, ConnectionQuality>>({});
  const [serverSpeakingNames, setServerSpeakingNames] = useState<string[]>([]);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const connectionAttemptRef = useRef(0);
  const serverSpeakingNamesRef = useRef<string[]>([]);
  const speakerReleaseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const micPermissionRef = useRef(false);
  const selectedDeviceIdRef = useRef(selectedMic);
  const screenShareRef = useRef(false);
  const deafenMicTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const notificationsEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : initialNotificationsEnabled(localStorage),
  );
  const soundEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : readSoundEnabled(localStorage),
  );

  selectedDeviceIdRef.current = selectedMic;
  setDeafenVolumeActive(deafen);

  const {
    volumes,
    screenShareVolumes,
    mutedParticipants,
    screenShareMutedParticipants,
    applyParticipantVolumes,
    removeParticipant: removeParticipantVolume,
    setParticipantVolume,
    setScreenShareVolume,
    setLocalMute,
    toggleLocalMute,
    setLocalScreenShareMute,
    toggleLocalScreenShareMute,
    setRemoteMuted,
    getVolumeRef,
    getScreenShareVolumeRef,
    unmuteAllParticipants,
    resetState: resetParticipantVolumeState,
  } = useParticipantVolume(roomRef);

  const {
    screenShareEnabled,
    screenShares,
    localPreview,
    setScreenShare: setScreenShareForRoom,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    resetState: resetScreenShareState,
  } = useScreenShare();

  const {
    noiseFilter,
    krispSupported,
    micProcessorRevision,
    ensureKrispLoaded,
    createKrispProcessor,
    attachKrispNoiseFilter,
    applyInitialProcessor,
    setNoiseFilter: setKrispFilter,
    resetState: resetKrispFilterState,
  } = useKrispFilter();

  const { localSpeaking } = useLocalVoiceActivity({
    status,
    micEnabled: micOn,
    localMicTrack,
    micProcessorRevision,
  });

  screenShareRef.current = screenShareEnabled;

  const syncParticipants = useCallback(
    (room: LiveKitRoom) => {
      const remotes = Array.from(room.remoteParticipants.values()).map((p) => p.name || p.identity);
      const me = room.localParticipant.name || room.localParticipant.identity;
      setParticipants([me, ...remotes]);

      for (const p of room.remoteParticipants.values()) applyParticipantVolumes(p);
    },
    [applyParticipantVolumes],
  );

  const removeParticipant = useCallback(
    (name: string) => {
      removeParticipantVolume(name);

      const releaseTimer = speakerReleaseTimersRef.current.get(name);
      if (releaseTimer) clearTimeout(releaseTimer);
      speakerReleaseTimersRef.current.delete(name);
      serverSpeakingNamesRef.current = serverSpeakingNamesRef.current.filter(
        (speaker) => speaker !== name,
      );
      setServerSpeakingNames(serverSpeakingNamesRef.current);
      setRemoteQualities((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    },
    [removeParticipantVolume],
  );

  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setServerSpeakingNames([]);
    setLocalMicTrack(null);
    setLocalQuality(ConnectionQuality.Excellent);
    setRemoteQualities({});
    for (const timer of speakerReleaseTimersRef.current.values()) clearTimeout(timer);
    speakerReleaseTimersRef.current.clear();
    serverSpeakingNamesRef.current = [];
    resetParticipantVolumeState();
    resetScreenShareState();
    resetKrispFilterState();
  }, [resetParticipantVolumeState, resetScreenShareState, resetKrispFilterState]);

  const refreshMicDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    setMicDevices(audioInputDevices(devices));
  }, []);

  const syncLocalMicTrack = useCallback((room: LiveKitRoom) => {
    const publication = room.localParticipant.getTrackPublication("microphone" as TrackSource);
    setLocalMicTrack((publication?.track ?? null) as LocalAudioTrack | null);
  }, []);

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
          (async () => {
            const c = await import("livekit-client");
            setScreenShareAudioSource(c.Track.Source.ScreenShareAudio);
            return c;
          })(),
          api<VoiceTokenResponse>("/api/voice/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ room_id: roomId }),
          }),
          createKrispProcessor(),
        ]);
        if (connectionAttemptRef.current !== attemptId) return;
        const { Room, RoomEvent, Track } = client;
        const { token, url } = tokenResponse;

        const voiceAudioContext = new (
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )();
        attemptAudioContext = voiceAudioContext;
        voiceAudioContextRef.current = voiceAudioContext;
        const room = new Room({
          adaptiveStream: screenShareAdaptiveStreamSettings(),
          dynacast: true,
          webAudioMix: { audioContext: voiceAudioContext },
          publishDefaults: {
            videoCodec: "h264",
            simulcast: false,
          },
        });
        connectingRoom = room;
        roomRef.current = room;

        setupRoomHandlers({
          room,
          RoomEvent,
          Track,
          soundEnabledRef,
          notificationsEnabledRef,
          roomRef,
          screenShareRef,
          setRemoteMuted,
          applyParticipantVolumes,
          onTrackSubscribed,
          onTrackUnsubscribed,
          onLocalTrackUnpublished,
          syncLocalMicTrack,
          syncActiveSpeakerNames,
          setLocalQuality,
          setRemoteQualities,
          syncParticipants,
          removeParticipant,
          getScreenShareVolumeRef,
          closeVoiceAudioContext,
          resetRoomState,
          setStatus,
          setActiveRoomId,
        });

        const [createdTrack] = await room.localParticipant.createTracks({
          audio: audioCaptureOptions(selectedDeviceIdRef.current),
          video: false,
        });
        preparedMicTrack = createdTrack ? (createdTrack as LocalAudioTrack) : null;
        if (!preparedMicTrack) throw new Error("Não consegui preparar o microfone.");
        preparedMicTrack.setAudioContext(voiceAudioContext);

        if (initialProcessor) {
          await applyInitialProcessor(preparedMicTrack, initialProcessor);
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

        setMicOn(true);
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
      disconnect,
      applyParticipantVolumes,
      setRemoteMuted,
      getScreenShareVolumeRef,
      createKrispProcessor,
      applyInitialProcessor,
      closeVoiceAudioContext,
      syncParticipants,
      removeParticipant,
      syncActiveSpeakerNames,
      syncLocalMicTrack,
      onTrackSubscribed,
      onTrackUnsubscribed,
      onLocalTrackUnpublished,
      resetRoomState,
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
      setMicOn(enabled);
    },
    [attachKrispNoiseFilter, syncLocalMicTrack],
  );

  const setMicDevice = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.switchActiveDevice("audioinput", deviceId);
      setSelectedMic(deviceId);
      writeMicDeviceId(typeof localStorage === "undefined" ? null : localStorage, deviceId);
    } catch {
      setError("Não consegui trocar o microfone.");
    }
  }, []);

  const setNoiseFilter = useCallback(
    async (enabled: boolean) => {
      await setKrispFilter(enabled, roomRef, setError);
    },
    [setKrispFilter],
  );

  const queueDeafenMicrophoneState = useCallback(
    (enabled: boolean) => {
      const transition = deafenMicTransitionRef.current.then(() => setMicEnabled(enabled));
      deafenMicTransitionRef.current = transition.then(
        () => undefined,
        () => setError("Não consegui alterar o microfone."),
      );
    },
    [setMicEnabled],
  );

  const globalMuteActive =
    deafen ||
    isGlobalMuteActive(
      micOn,
      participants.slice(1),
      volumes,
      screenShares.map((share) => share.name),
      screenShareVolumes,
    );

  const toggleDeafen = useCallback(() => {
    if (globalMuteActive) {
      unmuteAllParticipants();
      setDeafen(false);
      queueDeafenMicrophoneState(microphoneEnabledAfterDeafenToggle(true));
      return;
    }
    setDeafen(true);
    queueDeafenMicrophoneState(microphoneEnabledAfterDeafenToggle(false));
  }, [globalMuteActive, queueDeafenMicrophoneState, unmuteAllParticipants]);

  const keepMicrophoneMutedAfterDeafen = useCallback(() => {
    setDeafen(false);
  }, []);

  const listenToParticipant = useCallback(
    (name: string, volume?: number) => {
      const room = roomRef.current;
      if (!room) return;

      const participantNames = Array.from(room.remoteParticipants.values()).map(
        (participant) => participant.name || participant.identity,
      );
      const namesToMute = participantNamesToMuteForSelectiveListening(participantNames, name);

      for (const participantName of namesToMute) {
        if (getVolumeRef()[participantName] !== 0) setLocalMute(participantName, true);
        if (getScreenShareVolumeRef()[participantName] !== 0) {
          setLocalScreenShareMute(participantName, true);
        }
      }

      keepMicrophoneMutedAfterDeafen();

      if (volume !== undefined) {
        setParticipantVolume(name, volume);
        return;
      }
      if (getVolumeRef()[name] === 0) setLocalMute(name, false);
    },
    [
      getScreenShareVolumeRef,
      getVolumeRef,
      keepMicrophoneMutedAfterDeafen,
      setLocalMute,
      setLocalScreenShareMute,
      setParticipantVolume,
    ],
  );

  const listenToParticipantScreenShare = useCallback(
    (name: string, volume?: number) => {
      const room = roomRef.current;
      if (!room) return;

      const participantNames = Array.from(room.remoteParticipants.values()).map(
        (participant) => participant.name || participant.identity,
      );
      const screenShareNamesToMute = participantNamesToMuteForSelectiveListening(
        participantNames,
        name,
      );

      for (const participantName of participantNames) {
        if (getVolumeRef()[participantName] !== 0) setLocalMute(participantName, true);
      }
      for (const participantName of screenShareNamesToMute) {
        if (getScreenShareVolumeRef()[participantName] !== 0) {
          setLocalScreenShareMute(participantName, true);
        }
      }

      keepMicrophoneMutedAfterDeafen();

      if (volume !== undefined) {
        setScreenShareVolume(name, volume);
        return;
      }
      if (getScreenShareVolumeRef()[name] === 0) setLocalScreenShareMute(name, false);
    },
    [
      getScreenShareVolumeRef,
      getVolumeRef,
      keepMicrophoneMutedAfterDeafen,
      setLocalMute,
      setLocalScreenShareMute,
      setScreenShareVolume,
    ],
  );

  // --- Effects ---

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
    return () => {
      connectionAttemptRef.current += 1;
      void roomRef.current?.disconnect();
      void closeVoiceAudioContext();
      roomRef.current = null;
    };
  }, [closeVoiceAudioContext]);

  const localName = participants[0];
  const speakingNames =
    localSpeaking && localName
      ? Array.from(new Set([...serverSpeakingNames, localName]))
      : serverSpeakingNames;

  const clearError = useCallback(() => setError(null), []);

  const setScreenShare = useCallback(
    async (enabled: boolean, quality?: ScreenShareQuality) => {
      const room = roomRef.current;
      if (!room) return;
      await setScreenShareForRoom(room, enabled, quality);
    },
    [setScreenShareForRoom],
  );

  return {
    status,
    activeRoomId,
    participants,
    micEnabled: micOn,
    volumes,
    screenShareVolumes,
    screenShareEnabled,
    screenShares,
    micDevices,
    selectedDeviceId: selectedMic,
    noiseFilter,
    krispSupported,
    selfMonitor,
    mutedParticipants,
    screenShareMutedParticipants,
    speakingNames,
    localPreview,
    deafen: globalMuteActive,
    error,
    localQuality,
    remoteQualities,
    clearError,
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
    listenToParticipant,
    listenToParticipantScreenShare,
  };
}
