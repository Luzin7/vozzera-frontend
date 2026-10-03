import { useCallback, useEffect, useRef, useState } from "react";

import { ConnectionQuality } from "livekit-client";
import { api } from "./api";
import {
  setRemoteParticipantScreenShareVolume,
  useParticipantVolume,
} from "./use-participant-volume";
import { useScreenShare } from "./use-screen-share";
import type { ScreenShare as ScreenShareType } from "./use-screen-share";
import { useScreenShareHealth } from "./use-screen-share-health";
import { useKrispFilter } from "./use-krisp-filter";
import { useLocalVoiceActivity } from "./use-local-voice-activity";
import type { VoiceTokenResponse } from "./types";
import {
  applyVideoPlaybackDelay,
  applyVolumeWithElementMuted,
  audioCaptureOptions,
  audioInputDevices,
  DEAFEN_DATA_TOPIC,
  deafenStateFromPayload,
  deafenStatePayload,
  mergeActiveSpeakerNames,
  microphoneEnabledAfterDeafenEnd,
  microphonePublishOptions,
  readMicDeviceId,
  readPushToTalkBinding,
  readPushToTalkEnabled,
  screenShareAdaptiveStreamSettings,
  shouldHandlePushToTalk,
  VIDEO_PLAYBACK_DELAY_MS,
  writeMicDeviceId,
  writePushToTalkBinding,
  writePushToTalkEnabled,
} from "./voice";
import type { MicDevice, ScreenShareIntent } from "./voice";
import { screenShareErrorMessageFor } from "./screen-share-errors";
import { canNotify, initialNotificationsEnabled } from "./notifications";
import { playVoiceActionSound } from "./voice-sounds";

export type VoiceStatus = "idle" | "connecting" | "connected";

export type ConnectionState = "connected" | "reconnecting";

type LiveKitRoom = import("livekit-client").Room;
type LocalAudioTrack = import("livekit-client").LocalAudioTrack;
type TrackSource = import("livekit-client").Track.Source;

export type ScreenShareTrack = import("./use-screen-share").ScreenShareTrack;

export type ScreenShare = ScreenShareType;

const VOICE_RELEASE_DELAY_MS = 40;

type DeafenTransition = {
  enabled: boolean;
  micEnabled: boolean;
};

function setAudioContextSuspended(audioContext: AudioContext | null, suspended: boolean) {
  if (!audioContext || audioContext.state === "closed") return Promise.resolve();
  if (suspended) return audioContext.suspend();
  return audioContext.resume();
}

function suspendAudioForDeafen(
  audioContextRef: { readonly current: AudioContext | null },
  deafenRef: { readonly current: boolean },
): void {
  if (!deafenRef.current) return;
  void setAudioContextSuspended(audioContextRef.current, true);
}

function publishDeafenState(room: LiveKitRoom | null, enabled: boolean) {
  if (!room) return;
  void room.localParticipant
    .publishData(deafenStatePayload(enabled), { reliable: true, topic: DEAFEN_DATA_TOPIC })
    .catch(() => {
      // best-effort: falha ao publicar o mudo total não deve interromper o áudio
    });
}

function editableDetailsFor(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return { tagName: undefined, contentEditable: false };
  }
  return { tagName: target.tagName, contentEditable: target.isContentEditable };
}

type RoomEventHandlerCtx = {
  room: LiveKitRoom;
  RoomEvent: typeof import("livekit-client").RoomEvent;
  Track: typeof import("livekit-client").Track;
  notificationsEnabledRef: { readonly current: boolean };
  roomRef: { current: LiveKitRoom | null };
  screenShareRef: { current: boolean };
  screenShareAudioSourceRef: { readonly current: unknown };
  voiceAudioContextRef: { readonly current: AudioContext | null };
  deafenRef: { readonly current: boolean };
  setRemoteMuted: (name: string, muted: boolean) => void;
  setRemoteDeafened: (name: string, deafened: boolean) => void;
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
  setConnectionState: (state: ConnectionState) => void;
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
    notificationsEnabledRef,
    roomRef,
    screenShareRef,
    screenShareAudioSourceRef,
    voiceAudioContextRef,
    deafenRef,
    setRemoteMuted,
    setRemoteDeafened,
    applyParticipantVolumes,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    syncLocalMicTrack,
    syncActiveSpeakerNames,
    setConnectionState,
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
      if (track.source === Track.Source.ScreenShare) playVoiceActionSound("screen-share-start");
      return;
    }

    const el = track.attach();
    el.style.display = "none";
    document.body.appendChild(el);
    suspendAudioForDeafen(voiceAudioContextRef, deafenRef);

    if (participant.isLocal) return;

    const name = participant.name || participant.identity;
    if (publication.source === Track.Source.Microphone) {
      setRemoteMuted(name, publication.isMuted);
      applyParticipantVolumes(participant);
      return;
    }
    if (publication.source === Track.Source.ScreenShareAudio) {
      applyVideoPlaybackDelay(track, VIDEO_PLAYBACK_DELAY_MS);
      applyVolumeWithElementMuted(el, () => applyParticipantVolumes(participant));
      return;
    }
    applyParticipantVolumes(participant);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.source !== Track.Source.ScreenShare) {
      track.detach().forEach((el) => el.remove());
      return;
    }
    onTrackUnsubscribed(track);
    playVoiceActionSound("screen-share-stop");
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
    if (participant.isLocal) return;

    const name = participant.name || participant.identity;
    setRemoteQualities((prev) => ({ ...prev, [name]: quality }));
  });

  room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    if (topic !== DEAFEN_DATA_TOPIC || !participant) return;
    const deafened = deafenStateFromPayload(payload);
    if (deafened === null) return;
    setRemoteDeafened(participant.name || participant.identity, deafened);
  });

  room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    suspendAudioForDeafen(voiceAudioContextRef, deafenRef);
  });

  room.on(RoomEvent.LocalTrackPublished, (publication) => {
    if (publication.track?.source !== Track.Source.ScreenShare) return;

    playVoiceActionSound("screen-share-start");
  });

  room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
    onLocalTrackUnpublished(publication);
    if (publication.track?.source !== Track.Source.ScreenShare) return;

    playVoiceActionSound("screen-share-stop");
  });

  room.on(RoomEvent.Reconnecting, () => setConnectionState("reconnecting"));
  room.on(RoomEvent.SignalReconnecting, () => setConnectionState("reconnecting"));
  room.on(RoomEvent.Reconnected, () => setConnectionState("connected"));

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    syncParticipants(room);

    const name = participant.name || participant.identity;
    const me = room.localParticipant.name || room.localParticipant.identity;
    if (name === me) return;
    publishDeafenState(room, deafenRef.current);

    const ssVolume = getScreenShareVolumeRef()[name];
    if (ssVolume !== undefined) {
      const remoteParticipant = room.remoteParticipants.get(participant.sid);
      if (remoteParticipant)
        setRemoteParticipantScreenShareVolume(
          remoteParticipant,
          ssVolume,
          screenShareAudioSourceRef.current,
        );
    }

    if (
      typeof document !== "undefined" &&
      canNotify(notificationsEnabledRef.current, document.hidden)
    ) {
      new Notification("Canal de voz", { body: `${name} entrou no canal` });
    }

    playVoiceActionSound("join");
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant) => {
    const name = participant.name || participant.identity;
    removeParticipant(name);
    syncParticipants(room);
    playVoiceActionSound("leave");

    if (
      typeof document !== "undefined" &&
      canNotify(notificationsEnabledRef.current, document.hidden)
    ) {
      new Notification("Canal de voz", { body: `${name} saiu do canal` });
    }
  });

  room.on(RoomEvent.Disconnected, () => {
    void closeVoiceAudioContext();
    setConnectionState("connected");
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
  const [pushToTalkEnabled, setPushToTalkEnabledState] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return readPushToTalkEnabled(localStorage);
  });
  const [pushToTalkBinding, setPushToTalkBindingState] = useState(() =>
    readPushToTalkBinding(typeof localStorage === "undefined" ? null : localStorage),
  );
  const [error, setError] = useState<string | null>(null);
  const [deafen, setDeafen] = useState(false);
  const [localMicTrack, setLocalMicTrack] = useState<LocalAudioTrack | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [remoteQualities, setRemoteQualities] = useState<Record<string, ConnectionQuality>>({});
  const [deafenedParticipants, setDeafenedParticipants] = useState<Record<string, boolean>>({});
  const [serverSpeakingNames, setServerSpeakingNames] = useState<string[]>([]);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const connectionAttemptRef = useRef(0);
  const serverSpeakingNamesRef = useRef<string[]>([]);
  const speakerReleaseTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const micPermissionRef = useRef(false);
  const selectedDeviceIdRef = useRef(selectedMic);
  const screenShareRef = useRef(false);
  const deafenRef = useRef(deafen);
  deafenRef.current = deafen;
  const screenShareAudioSourceRef = useRef<unknown>(null);
  const deafenTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const micEnabledBeforeDeafenRef = useRef(true);
  const pushToTalkTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const pushToTalkPressedRef = useRef(false);
  const pushToTalkEnabledRef = useRef(pushToTalkEnabled);
  const pushToTalkBindingRef = useRef(pushToTalkBinding);
  const notificationsEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : initialNotificationsEnabled(localStorage),
  );

  selectedDeviceIdRef.current = selectedMic;
  pushToTalkEnabledRef.current = pushToTalkEnabled;
  pushToTalkBindingRef.current = pushToTalkBinding;

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
    getScreenShareVolumeRef,
    resetState: resetParticipantVolumeState,
  } = useParticipantVolume(roomRef, screenShareAudioSourceRef);

  const {
    screenShareEnabled,
    screenShares,
    localPreview,
    setScreenShare: setScreenShareForRoom,
    applyScreenShareIntent,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    resetState: resetScreenShareState,
  } = useScreenShare();

  const screenShareHealth = useScreenShareHealth(
    roomRef,
    status === "connected" && screenShareEnabled,
  );

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
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      const remotes = remoteParticipants.map(
        (participant) => participant.name || participant.identity,
      );
      const me = room.localParticipant.name || room.localParticipant.identity;
      setParticipants([me, ...remotes]);
      for (const participant of remoteParticipants) applyParticipantVolumes(participant);
    },
    [applyParticipantVolumes],
  );

  const setRemoteDeafened = useCallback((name: string, deafened: boolean) => {
    setDeafenedParticipants((prev) => ({ ...prev, [name]: deafened }));
  }, []);

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
      setDeafenedParticipants((prev) => {
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
    setDeafen(false);
    setLocalMicTrack(null);
    setRemoteQualities({});
    setDeafenedParticipants({});
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
    const wasConnected = roomRef.current !== null;
    connectionAttemptRef.current += 1;
    await roomRef.current?.disconnect();
    await closeVoiceAudioContext();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    resetRoomState();
    if (wasConnected) playVoiceActionSound("leave");
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
            screenShareAudioSourceRef.current = c.Track.Source.ScreenShareAudio;
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
        voiceAudioContext.onstatechange = () => {
          suspendAudioForDeafen(voiceAudioContextRef, deafenRef);
        };
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
          notificationsEnabledRef,
          roomRef,
          screenShareRef,
          screenShareAudioSourceRef,
          voiceAudioContextRef,
          deafenRef,
          setRemoteMuted,
          setRemoteDeafened,
          applyParticipantVolumes,
          onTrackSubscribed,
          onTrackUnsubscribed,
          onLocalTrackUnpublished,
          syncLocalMicTrack,
          syncActiveSpeakerNames,
          setConnectionState,
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

        if (pushToTalkEnabledRef.current) {
          await room.localParticipant.setMicrophoneEnabled(false);
        }

        setMicOn(!pushToTalkEnabledRef.current);
        syncLocalMicTrack(room);
        micPermissionRef.current = true;
        setStatus("connected");
        setConnectionState("connected");
        setActiveRoomId(roomId);
        syncParticipants(room);
        playVoiceActionSound("join");
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
      setRemoteDeafened,
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
      playVoiceActionSound(enabled ? "unmute" : "mute");
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

  const updateDeafenState = useCallback(
    async ({ enabled, micEnabled }: DeafenTransition) => {
      const audioContext = voiceAudioContextRef.current;

      if (enabled) {
        await Promise.all([setMicEnabled(false), setAudioContextSuspended(audioContext, true)]);
        publishDeafenState(roomRef.current, true);
        return;
      }

      const restoredMic = microphoneEnabledAfterDeafenEnd(pushToTalkEnabledRef.current, micEnabled);
      await Promise.all([
        setMicEnabled(restoredMic),
        setAudioContextSuspended(audioContext, false),
      ]);
      publishDeafenState(roomRef.current, false);
    },
    [setMicEnabled],
  );

  const queueDeafenState = useCallback(
    (transition: DeafenTransition) => {
      const pending = deafenTransitionRef.current.then(() => updateDeafenState(transition));
      deafenTransitionRef.current = pending.then(
        () => setError(null),
        () => setError("Não consegui alterar o mudo total."),
      );
    },
    [updateDeafenState],
  );

  const applyDeafen = useCallback(
    (enabled: boolean) => {
      if (enabled) micEnabledBeforeDeafenRef.current = micOn;
      deafenRef.current = enabled;
      setDeafen(enabled);
      queueDeafenState({ enabled, micEnabled: micEnabledBeforeDeafenRef.current });
    },
    [micOn, queueDeafenState],
  );

  const queuePushToTalkMicrophoneState = useCallback(
    (enabled: boolean) => {
      const transition = pushToTalkTransitionRef.current.then(() => setMicEnabled(enabled));
      pushToTalkTransitionRef.current = transition.then(
        () => undefined,
        () => setError("Não consegui alterar o microfone."),
      );
    },
    [setMicEnabled],
  );

  const setPushToTalkEnabled = useCallback(
    (enabled: boolean) => {
      pushToTalkEnabledRef.current = enabled;
      pushToTalkPressedRef.current = false;
      setPushToTalkEnabledState(enabled);
      writePushToTalkEnabled(typeof localStorage === "undefined" ? null : localStorage, enabled);
      if (status === "connected") {
        queuePushToTalkMicrophoneState(!enabled && !deafenRef.current);
      }
    },
    [queuePushToTalkMicrophoneState, status],
  );

  const setPushToTalkBinding = useCallback((code: string, label: string) => {
    const binding = { code, label };
    pushToTalkBindingRef.current = binding;
    setPushToTalkBindingState(binding);
    writePushToTalkBinding(typeof localStorage === "undefined" ? null : localStorage, binding);
  }, []);

  const toggleDeafen = useCallback(() => {
    applyDeafen(!deafenRef.current);
  }, [applyDeafen]);

  const toggleMic = useCallback(() => {
    if (deafenRef.current) {
      applyDeafen(false);
      return;
    }
    void setMicEnabled(!micOn);
  }, [applyDeafen, micOn, setMicEnabled]);

  // --- Effects ---

  useEffect(() => {
    if (!pushToTalkEnabled || status !== "connected") return;

    const releaseMicrophone = () => {
      if (!pushToTalkPressedRef.current) return;
      pushToTalkPressedRef.current = false;
      queuePushToTalkMicrophoneState(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const { tagName, contentEditable } = editableDetailsFor(event.target);
      if (
        !shouldHandlePushToTalk(
          event.code,
          pushToTalkBindingRef.current.code,
          event.repeat,
          tagName,
          contentEditable,
        )
      )
        return;
      if (deafenRef.current) return;
      pushToTalkPressedRef.current = true;
      queuePushToTalkMicrophoneState(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== pushToTalkBindingRef.current.code) return;
      releaseMicrophone();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseMicrophone);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseMicrophone);
      releaseMicrophone();
    };
  }, [pushToTalkEnabled, queuePushToTalkMicrophoneState, status]);

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
    async (enabled: boolean, intent?: ScreenShareIntent) => {
      const room = roomRef.current;
      if (!room) return;

      try {
        await setScreenShareForRoom(room, enabled, intent);
      } catch (err) {
        const message = screenShareErrorMessageFor(err);
        if (message) setError(message);
      }
    },
    [setScreenShareForRoom],
  );

  const reduceScreenQuality = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await applyScreenShareIntent(room, "economy");
    } catch {
      setError("Não consegui reduzir a qualidade da transmissão.");
    }
  }, [applyScreenShareIntent]);

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
    pushToTalkEnabled,
    pushToTalkBinding,
    mutedParticipants,
    deafenedParticipants,
    screenShareMutedParticipants,
    speakingNames,
    localPreview,
    deafen,
    error,
    connectionState,
    screenShareHealth,
    remoteQualities,
    clearError,
    ensureKrispLoaded,
    connect,
    disconnect,
    setMicEnabled,
    setMicDevice,
    setNoiseFilter,
    setSelfMonitor,
    setPushToTalkEnabled,
    setPushToTalkBinding,
    setParticipantVolume,
    setScreenShareVolume,
    setLocalMute,
    toggleLocalMute,
    setLocalScreenShareMute,
    toggleLocalScreenShareMute,
    setScreenShare,
    reduceScreenQuality,
    toggleDeafen,
    toggleMic,
  };
}
