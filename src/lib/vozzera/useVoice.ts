import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConnectionQuality } from "livekit-client";
import { api } from "./api";
import {
  callParticipantFrom,
  omitIdentity,
  reuseCallParticipants,
  setIdentityValue,
} from "./call-participants";
import type { CallParticipant } from "./call-participants";
import { useParticipantVolume } from "./use-participant-volume";
import type { ScreenShareAudioSource } from "./use-participant-volume";
import { useLiveShareWatch } from "./use-live-share-watch";
import type { LiveShareWatchResult } from "./use-live-share-watch";
import { useScreenShare } from "./use-screen-share";
import type { ScreenShare as ScreenShareType } from "./use-screen-share";
import { useScreenShareHealth } from "./use-screen-share-health";
import {
  MicrophoneUnavailableError,
  microphoneToggleErrorMessageFor,
  voiceDisconnectMessageFor,
  voiceJoinErrorMessageFor,
} from "./voice-errors";
import { disconnectRouteFor } from "./away";
import type { ExitNoticeReason } from "./away";
import type { AwayReason } from "./away-intent";
import { useKrispFilter } from "./use-krisp-filter";
import { useSpeakingDetection } from "./use-speaking-detection";
import { getVoicePreferences } from "./voice-preferences";
import type { VoiceTokenResponse } from "./types";
import {
  applyMicDeviceChoice,
  applyVolumeWithElementMuted,
  audioCaptureOptions,
  audioInputDevices,
  DEAFEN_DATA_TOPIC,
  deafenStateFromPayload,
  flagStatePayload,
  initialMicEnabled,
  localSpoke,
  micEnabledToRestore,
  microphoneEnabledAfterDeafenEnd,
  microphonePublishOptions,
  PUSH_TO_TALK_DATA_TOPIC,
  pushToTalkStateFromPayload,
  readMicDeviceId,
  remoteSpeakerIdentities,
  readPushToTalkBinding,
  readPushToTalkEnabled,
  roomAudioCaptureDefaults,
  screenShareAdaptiveStreamSettings,
  shouldHandlePushToTalk,
  visibleMutedParticipants,
  writePushToTalkBinding,
  writePushToTalkEnabled,
} from "./voice";
import type { MicDevice, ScreenShareIntent } from "./voice";
import { screenShareErrorMessageFor } from "./screen-share-errors";
import { canNotify, initialNotificationsEnabled } from "./notifications";
import {
  createIdlePermissionGate,
  isIdleDetectionSupported,
  requestIdleDetectionPermission,
  startIdleDetection,
  stopIdleDetection,
} from "./idle-detection";
import type { IdlePermissionGate } from "./idle-detection";
import { playVoiceActionSound, primeVoiceSounds } from "./voice-sounds";

export type VoiceStatus = "idle" | "connecting" | "connected" | "away";

type SessionSnapshot = {
  roomId: string;
  micEnabled: boolean;
  deafen: boolean;
  hardMuted: boolean;
};

export type AwayInfo = SessionSnapshot & { reason: AwayReason };

export type ExitNotice = SessionSnapshot & { reason: ExitNoticeReason };

export type ConnectOptions = { micEnabled?: boolean; deafen?: boolean; hardMuted?: boolean };

type UseVoiceOptions = { onReturned?: () => void };

export type ConnectionState = "connected" | "reconnecting";

type LiveKitRoom = import("livekit-client").Room;
type LocalAudioTrack = import("livekit-client").LocalAudioTrack;
type TrackSource = import("livekit-client").Track.Source;

export type ScreenShareTrack = import("./use-screen-share").ScreenShareTrack;

export type ScreenShare = ScreenShareType;

const AWAY_DISCONNECT_TIMEOUT_MS = 5_000;

async function disconnectWithin(room: LiveKitRoom, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([room.disconnect().catch(() => undefined), timeout]);
  clearTimeout(timer);
}

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

function publishFlag(room: LiveKitRoom | null, topic: string, enabled: boolean) {
  if (!room) return;
  void room.localParticipant
    .publishData(flagStatePayload(enabled), { reliable: true, topic })
    .catch(() => {
      // best-effort: falha ao publicar o estado não deve interromper o áudio
    });
}

function publishDeafenState(room: LiveKitRoom | null, enabled: boolean) {
  publishFlag(room, DEAFEN_DATA_TOPIC, enabled);
}

function publishPushToTalkIdleState(room: LiveKitRoom | null, idle: boolean) {
  publishFlag(room, PUSH_TO_TALK_DATA_TOPIC, idle);
}

function clearPushToTalkReleaseTimer(timerRef: {
  current: ReturnType<typeof setTimeout> | null;
}): void {
  if (timerRef.current === null) return;
  clearTimeout(timerRef.current);
  timerRef.current = null;
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
  ParticipantEvent: typeof import("livekit-client").ParticipantEvent;
  TrackEvent: typeof import("livekit-client").TrackEvent;
  Track: typeof import("livekit-client").Track;
  notificationsEnabledRef: { readonly current: boolean };
  roomRef: { current: LiveKitRoom | null };
  voiceAudioContextRef: { readonly current: AudioContext | null };
  deafenRef: { readonly current: boolean };
  pushToTalkIdleRef: { readonly current: boolean };
  setRemoteMuted: (identity: string, muted: boolean) => void;
  setRemoteDeafened: (identity: string, deafened: boolean) => void;
  setRemotePushToTalkIdle: (identity: string, idle: boolean) => void;
  speaking: Pick<
    ReturnType<typeof useSpeakingDetection>,
    "addRemoteMicrophone" | "removeRemote" | "setServerSpeakers"
  >;
  applyParticipantVolumes: (p: import("livekit-client").RemoteParticipant) => void;
  onTrackSubscribed: (
    track: import("livekit-client").Track,
    publication: import("livekit-client").TrackPublication,
    participant: import("livekit-client").Participant,
  ) => void;
  onTrackUnsubscribed: (track: import("livekit-client").Track) => boolean;
  onLocalTrackUnpublished: (publication: import("livekit-client").LocalTrackPublication) => void;
  liveShare: Pick<
    LiveShareWatchResult,
    | "onShareTrackPublished"
    | "onShareTrackUnpublished"
    | "onParticipantDisconnected"
    | "refreshLiveShares"
    | "applyInitialShares"
    | "hasWatchIntent"
  >;
  syncLocalMicTrack: (room: LiveKitRoom) => void;
  onLocalSpeech: () => void;
  onDisconnected: (reason: import("livekit-client").DisconnectReason | undefined) => void;
  setConnectionState: (state: ConnectionState) => void;
  setQualities: React.Dispatch<React.SetStateAction<Record<string, ConnectionQuality>>>;
  syncParticipants: (room: LiveKitRoom) => void;
  removeParticipant: (identity: string) => void;
  closeVoiceAudioContext: (ctx?: AudioContext | null) => Promise<void>;
};

function setupRoomHandlers(ctx: RoomEventHandlerCtx): void {
  const {
    room,
    RoomEvent,
    ParticipantEvent,
    TrackEvent,
    Track,
    notificationsEnabledRef,
    roomRef,
    voiceAudioContextRef,
    deafenRef,
    pushToTalkIdleRef,
    setRemoteMuted,
    setRemoteDeafened,
    setRemotePushToTalkIdle,
    speaking,
    applyParticipantVolumes,
    onTrackSubscribed,
    onTrackUnsubscribed,
    onLocalTrackUnpublished,
    liveShare,
    syncLocalMicTrack,
    setConnectionState,
    setQualities,
    syncParticipants,
    removeParticipant,
    closeVoiceAudioContext,
    onLocalSpeech,
    onDisconnected,
  } = ctx;

  room.on(RoomEvent.TrackPublished, (publication, participant) => {
    liveShare.onShareTrackPublished(room, publication, participant);
  });

  room.on(RoomEvent.TrackUnpublished, (_publication, participant) =>
    liveShare.onShareTrackUnpublished(room, participant),
  );

  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    const isShare =
      publication.source === Track.Source.ScreenShare ||
      publication.source === Track.Source.ScreenShareAudio;
    if (isShare && !liveShare.hasWatchIntent(participant.identity)) {
      publication.setSubscribed(false);
      return;
    }

    if (track.kind !== Track.Kind.Audio) {
      onTrackSubscribed(track, publication, participant);
      if (track.source === Track.Source.ScreenShare) playVoiceActionSound("screen-share-start");
      return;
    }

    track.on(TrackEvent.AudioPlaybackStarted, () =>
      suspendAudioForDeafen(voiceAudioContextRef, deafenRef),
    );
    track.on(TrackEvent.AudioPlaybackFailed, () =>
      suspendAudioForDeafen(voiceAudioContextRef, deafenRef),
    );

    if (!participant.isLocal && publication.source === Track.Source.Microphone) {
      speaking.addRemoteMicrophone(participant.identity, track);
    }

    const el = track.attach();
    el.style.display = "none";
    document.body.appendChild(el);

    if (participant.isLocal) return;

    if (publication.source === Track.Source.Microphone) {
      setRemoteMuted(participant.identity, publication.isMuted);
      applyParticipantVolumes(participant);
      return;
    }
    if (publication.source === Track.Source.ScreenShareAudio) {
      applyVolumeWithElementMuted(el, () => applyParticipantVolumes(participant));
      return;
    }
    applyParticipantVolumes(participant);
  });

  room.on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) => {
    if (track.source === Track.Source.Microphone)
      speaking.removeRemote(participant.identity, track);
    if (track.source !== Track.Source.ScreenShare) {
      track.detach().forEach((el) => el.remove());
      return;
    }
    if (onTrackUnsubscribed(track)) playVoiceActionSound("screen-share-stop");
  });

  room.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (publication.source !== Track.Source.Microphone) return;

    if (participant.isLocal) {
      syncLocalMicTrack(room);
      return;
    }

    setRemoteMuted(participant.identity, true);
  });

  room.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (publication.source !== Track.Source.Microphone) return;

    if (participant.isLocal) {
      syncLocalMicTrack(room);
      return;
    }

    setRemoteMuted(participant.identity, false);
  });

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    const localIdentity = room.localParticipant.identity;
    const rawIdentities = speakers.map((p) => p.identity);
    if (localSpoke(rawIdentities, localIdentity)) onLocalSpeech();
    speaking.setServerSpeakers(remoteSpeakerIdentities(rawIdentities, localIdentity));
  });

  room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
    setQualities((prev) => setIdentityValue(prev, participant.identity, quality));
  });

  room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    if (!participant) return;
    if (topic === PUSH_TO_TALK_DATA_TOPIC) {
      const idle = pushToTalkStateFromPayload(payload);
      if (idle !== null) setRemotePushToTalkIdle(participant.identity, idle);
      return;
    }
    if (topic !== DEAFEN_DATA_TOPIC) return;
    const deafened = deafenStateFromPayload(payload);
    if (deafened === null) return;
    setRemoteDeafened(participant.identity, deafened);
  });

  room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
    suspendAudioForDeafen(voiceAudioContextRef, deafenRef);
  });

  room.localParticipant.on(ParticipantEvent.AudioStreamAcquired, () => {
    queueMicrotask(() => suspendAudioForDeafen(voiceAudioContextRef, deafenRef));
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
  room.on(RoomEvent.Reconnected, () => {
    setConnectionState("connected");
    liveShare.applyInitialShares(room);
  });

  room.on(RoomEvent.ParticipantConnected, (participant) => {
    syncParticipants(room);
    liveShare.applyInitialShares(room);

    const name = participant.name || participant.identity;
    if (participant.identity === room.localParticipant.identity) return;
    publishDeafenState(room, deafenRef.current);
    publishPushToTalkIdleState(room, pushToTalkIdleRef.current);

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
    removeParticipant(participant.identity);
    syncParticipants(room);
    liveShare.onParticipantDisconnected(room, participant.identity);
    playVoiceActionSound("leave");

    if (
      typeof document !== "undefined" &&
      canNotify(notificationsEnabledRef.current, document.hidden)
    ) {
      new Notification("Canal de voz", { body: `${name} saiu do canal` });
    }
  });

  room.on(RoomEvent.Disconnected, (reason) => {
    void closeVoiceAudioContext();
    setConnectionState("connected");
    if (roomRef.current !== room) return;
    roomRef.current = null;
    onDisconnected(reason);
  });
}

export function useVoice(options?: UseVoiceOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [awayInfo, setAwayInfo] = useState<AwayInfo | null>(null);
  const [exitNotice, setExitNotice] = useState<ExitNotice | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
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
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [qualities, setQualities] = useState<Record<string, ConnectionQuality>>({});
  const [deafenedParticipants, setDeafenedParticipants] = useState<Record<string, boolean>>({});
  const [pushToTalkIdleParticipants, setPushToTalkIdleParticipants] = useState<
    Record<string, boolean>
  >({});
  const [hardMuted, setHardMuted] = useState(false);

  const roomRef = useRef<LiveKitRoom | null>(null);
  const statusRef = useRef(status);
  const activeRoomIdRef = useRef(activeRoomId);
  const awayInfoRef = useRef(awayInfo);
  const exitNoticeRef = useRef(exitNotice);
  const micOnRef = useRef(micOn);
  const lastRemoteCountRef = useRef(0);
  const lastLocalSpeechAtRef = useRef(0);
  const onReturnedRef = useRef(options?.onReturned);
  const voiceAudioContextRef = useRef<AudioContext | null>(null);
  const connectionAttemptRef = useRef(0);
  const hardMutedRef = useRef(hardMuted);
  const micPermissionRef = useRef(false);
  const idlePermissionGateRef = useRef<IdlePermissionGate | null>(null);
  const selectedDeviceIdRef = useRef(selectedMic);
  const deafenRef = useRef(deafen);
  deafenRef.current = deafen;
  hardMutedRef.current = hardMuted;
  statusRef.current = status;
  activeRoomIdRef.current = activeRoomId;
  awayInfoRef.current = awayInfo;
  exitNoticeRef.current = exitNotice;
  micOnRef.current = micOn;
  onReturnedRef.current = options?.onReturned;
  const screenShareAudioSourceRef = useRef<ScreenShareAudioSource | null>(null);
  const deafenTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const micEnabledBeforeDeafenRef = useRef(true);
  const pushToTalkTransitionRef = useRef<Promise<void>>(Promise.resolve());
  const pushToTalkPressedRef = useRef(false);
  const pushToTalkMicOpenRef = useRef(false);
  const pushToTalkReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushToTalkIdleRef = useRef(false);
  const pushToTalkEnabledRef = useRef(pushToTalkEnabled);
  const pushToTalkBindingRef = useRef(pushToTalkBinding);
  const notificationsEnabledRef = useRef(
    typeof localStorage === "undefined" ? false : initialNotificationsEnabled(localStorage),
  );

  selectedDeviceIdRef.current = selectedMic;
  idlePermissionGateRef.current ??= createIdlePermissionGate(requestIdleDetectionPermission);
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

  const {
    liveShares,
    watchingIdentities,
    watchShare: watchShareInRoom,
    stopWatchingShare: stopWatchingShareInRoom,
    applyInitialShares,
    refreshLiveShares,
    hasWatchIntent,
    onShareTrackPublished,
    onShareTrackUnpublished,
    onParticipantDisconnected,
    resetState: resetLiveShareState,
  } = useLiveShareWatch();

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

  const onLocalSpeech = useCallback(() => {
    lastLocalSpeechAtRef.current = Date.now();
  }, []);

  const getLocalIdentity = useCallback(() => roomRef.current?.localParticipant.identity, []);

  const speaking = useSpeakingDetection({
    connected: status === "connected",
    micOpen: micOn,
    localMicTrack,
    micProcessorRevision,
    audioContextRef: voiceAudioContextRef,
    getLocalIdentity,
    onLocalSpeech,
  });
  const resetSpeaking = speaking.reset;
  const removeSpeaker = speaking.removeRemote;

  pushToTalkIdleRef.current = pushToTalkEnabled && !hardMuted;

  const syncParticipants = useCallback(
    (room: LiveKitRoom) => {
      const remoteParticipants = Array.from(room.remoteParticipants.values());
      lastRemoteCountRef.current = remoteParticipants.length;
      const localIdentity = room.localParticipant.identity;
      const next = [room.localParticipant, ...remoteParticipants].map((participant) =>
        callParticipantFrom(participant, localIdentity),
      );
      setParticipants((prev) => reuseCallParticipants(prev, next));
      for (const participant of remoteParticipants) applyParticipantVolumes(participant);
    },
    [applyParticipantVolumes],
  );

  const setRemoteDeafened = useCallback((identity: string, deafened: boolean) => {
    setDeafenedParticipants((prev) => setIdentityValue(prev, identity, deafened));
  }, []);

  const setRemotePushToTalkIdle = useCallback((identity: string, idle: boolean) => {
    setPushToTalkIdleParticipants((prev) => setIdentityValue(prev, identity, idle));
  }, []);

  const removeParticipant = useCallback(
    (identity: string) => {
      removeParticipantVolume(identity);
      removeSpeaker(identity);
      setQualities((prev) => omitIdentity(prev, identity));
      setDeafenedParticipants((prev) => omitIdentity(prev, identity));
      setPushToTalkIdleParticipants((prev) => omitIdentity(prev, identity));
    },
    [removeSpeaker, removeParticipantVolume],
  );

  const resetRoomState = useCallback(() => {
    setParticipants([]);
    setDeafen(false);
    setHardMuted(false);
    setLocalMicTrack(null);
    setQualities({});
    setConnectedAt(null);
    setDeafenedParticipants({});
    setPushToTalkIdleParticipants({});
    resetSpeaking();
    resetParticipantVolumeState();
    resetScreenShareState();
    resetLiveShareState();
    resetKrispFilterState();
  }, [
    resetSpeaking,
    resetParticipantVolumeState,
    resetScreenShareState,
    resetLiveShareState,
    resetKrispFilterState,
  ]);

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
    stopIdleDetection();
    connectionAttemptRef.current += 1;
    await roomRef.current?.disconnect();
    await closeVoiceAudioContext();
    roomRef.current = null;
    setStatus("idle");
    setActiveRoomId(null);
    resetRoomState();
    setAwayInfo(null);
    setExitNotice(null);
    if (wasConnected) playVoiceActionSound("leave");
  }, [closeVoiceAudioContext, resetRoomState]);

  const captureSession = useCallback(
    (roomId: string): SessionSnapshot => ({
      roomId,
      deafen: deafenRef.current,
      hardMuted: hardMutedRef.current,
      micEnabled: micEnabledToRestore({
        deafen: deafenRef.current,
        micBeforeDeafen: micEnabledBeforeDeafenRef.current,
        micOn: micOnRef.current,
      }),
    }),
    [],
  );

  const leaveRoomQuietly = useCallback(async () => {
    stopIdleDetection();
    const room = roomRef.current;
    connectionAttemptRef.current += 1;
    roomRef.current = null;
    if (room) await disconnectWithin(room, AWAY_DISCONNECT_TIMEOUT_MS);
    await closeVoiceAudioContext();
    setConnectionState("connected");
    setActiveRoomId(null);
    resetRoomState();
  }, [closeVoiceAudioContext, resetRoomState]);

  const parkSession = useCallback(
    async (park: (snapshot: SessionSnapshot) => void) => {
      stopIdleDetection();
      const roomId = activeRoomIdRef.current;
      if (statusRef.current !== "connected" || roomId === null) return;

      const snapshot = captureSession(roomId);
      await leaveRoomQuietly();
      park(snapshot);
    },
    [captureSession, leaveRoomQuietly],
  );

  const goAway = useCallback(
    (reason: AwayReason) =>
      parkSession((snapshot) => {
        setAwayInfo({ ...snapshot, reason });
        setStatus("away");
      }),
    [parkSession],
  );

  const leaveForInactivity = useCallback(
    () =>
      parkSession((snapshot) => {
        setExitNotice({ ...snapshot, reason: "inactivity" });
        setStatus("idle");
      }),
    [parkSession],
  );

  const endAway = useCallback((reason: "room_empty" | "quiet") => {
    const info = awayInfoRef.current;
    if (statusRef.current !== "away" || info === null) return;

    setAwayInfo(null);
    if (reason === "quiet") {
      setStatus("idle");
      return;
    }
    setExitNotice({
      roomId: info.roomId,
      micEnabled: info.micEnabled,
      deafen: info.deafen,
      hardMuted: info.hardMuted,
      reason,
    });
    setStatus("idle");
  }, []);

  const handleDisconnected = useCallback(
    (reason: import("livekit-client").DisconnectReason | undefined) => {
      stopIdleDetection();
      const roomId = activeRoomIdRef.current;
      const snapshot = roomId === null ? null : captureSession(roomId);
      const route = disconnectRouteFor(reason, lastRemoteCountRef.current);
      setActiveRoomId(null);
      resetRoomState();

      if (route === "default" || snapshot === null) {
        setStatus("idle");
        setError(voiceDisconnectMessageFor(reason));
        return;
      }
      if (route === "away") {
        setAwayInfo({ ...snapshot, reason: "connection" });
        setStatus("away");
        return;
      }
      setExitNotice({ ...snapshot, reason: "connection" });
      setStatus("idle");
    },
    [captureSession, resetRoomState],
  );

  const getLastLocalSpeechAt = useCallback(() => lastLocalSpeechAtRef.current, []);

  const watchShare = useCallback(
    (identity: string) => {
      const room = roomRef.current;
      if (room) watchShareInRoom(room, identity);
    },
    [watchShareInRoom],
  );

  const stopWatchingShare = useCallback(
    (identity: string) => {
      const room = roomRef.current;
      if (room) stopWatchingShareInRoom(room, identity);
    },
    [stopWatchingShareInRoom],
  );

  const setMicEnabled = useCallback(
    async (enabled: boolean, { silent = false }: { silent?: boolean } = {}) => {
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
      if (!silent) playVoiceActionSound(enabled ? "unmute" : "mute");
    },
    [attachKrispNoiseFilter, syncLocalMicTrack],
  );

  const setMicDevice = useCallback(async (deviceId: string) => {
    try {
      await applyMicDeviceChoice({
        deviceId,
        room: roomRef.current,
        storage: typeof localStorage === "undefined" ? null : localStorage,
        onSelected: setSelectedMic,
      });
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

  const requestIdlePermission = useCallback(() => {
    if (!isIdleDetectionSupported()) return;
    idlePermissionGateRef.current?.request();
  }, []);

  const connect = useCallback(
    async (roomId: string, connectOptions?: ConnectOptions): Promise<boolean> => {
      primeVoiceSounds();
      requestIdlePermission();
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
        if (connectionAttemptRef.current !== attemptId) return false;
        const { Room, RoomEvent, ParticipantEvent, TrackEvent, Track } = client;
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
          audioCaptureDefaults: roomAudioCaptureDefaults(),
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
          ParticipantEvent,
          TrackEvent,
          Track,
          notificationsEnabledRef,
          roomRef,
          voiceAudioContextRef,
          deafenRef,
          pushToTalkIdleRef,
          setRemoteMuted,
          setRemoteDeafened,
          setRemotePushToTalkIdle,
          speaking: {
            addRemoteMicrophone: speaking.addRemoteMicrophone,
            removeRemote: speaking.removeRemote,
            setServerSpeakers: speaking.setServerSpeakers,
          },
          applyParticipantVolumes,
          onTrackSubscribed,
          onTrackUnsubscribed,
          onLocalTrackUnpublished,
          liveShare: {
            onShareTrackPublished,
            onShareTrackUnpublished,
            onParticipantDisconnected,
            refreshLiveShares,
            applyInitialShares,
            hasWatchIntent,
          },
          syncLocalMicTrack,
          onLocalSpeech,
          onDisconnected: handleDisconnected,
          setConnectionState,
          setQualities,
          syncParticipants,
          removeParticipant,
          closeVoiceAudioContext,
        });

        const [createdTrack] = await room.localParticipant.createTracks({
          audio: audioCaptureOptions(selectedDeviceIdRef.current),
          video: false,
        });
        preparedMicTrack = createdTrack ? (createdTrack as LocalAudioTrack) : null;
        if (!preparedMicTrack) throw new MicrophoneUnavailableError();
        preparedMicTrack.setAudioContext(voiceAudioContext);

        if (initialProcessor) {
          await applyInitialProcessor(preparedMicTrack, initialProcessor);
        }

        if (connectionAttemptRef.current !== attemptId) {
          preparedMicTrack.stop();
          if (roomRef.current === room) roomRef.current = null;
          await closeVoiceAudioContext(voiceAudioContext);
          return false;
        }

        await room.connect(url, token);
        if (connectionAttemptRef.current !== attemptId) {
          await room.disconnect();
          preparedMicTrack.stop();
          await closeVoiceAudioContext(voiceAudioContext);
          return false;
        }
        await room.localParticipant.publishTrack(
          preparedMicTrack as Parameters<typeof room.localParticipant.publishTrack>[0],
          microphonePublishOptions(),
        );

        const micEnabledAtStart = initialMicEnabled(
          pushToTalkEnabledRef.current,
          connectOptions?.micEnabled,
        );
        if (!micEnabledAtStart) {
          await room.localParticipant.setMicrophoneEnabled(false);
        }

        setMicOn(micEnabledAtStart);
        syncLocalMicTrack(room);
        micPermissionRef.current = true;
        setStatus("connected");
        setConnectedAt(Date.now());
        startIdleDetection();
        setConnectionState("connected");
        setActiveRoomId(roomId);
        syncParticipants(room);
        applyInitialShares(room);
        setAwayInfo(null);
        setExitNotice(null);
        const hardMutedAtStart = pushToTalkEnabledRef.current && connectOptions?.hardMuted === true;
        hardMutedRef.current = hardMutedAtStart;
        setHardMuted(hardMutedAtStart);
        publishPushToTalkIdleState(room, pushToTalkEnabledRef.current && !hardMutedAtStart);
        if (connectOptions?.deafen) {
          micEnabledBeforeDeafenRef.current = connectOptions.micEnabled ?? true;
          deafenRef.current = true;
          setDeafen(true);
          queueDeafenState({ enabled: true, micEnabled: micEnabledBeforeDeafenRef.current });
        }
        playVoiceActionSound("join");
        return true;
      } catch (err) {
        if (connectingRoom && roomRef.current === connectingRoom) roomRef.current = null;
        await connectingRoom?.disconnect().catch(() => undefined);
        preparedMicTrack?.stop();
        await closeVoiceAudioContext(attemptAudioContext);
        if (connectionAttemptRef.current !== attemptId) return false;
        setError(voiceJoinErrorMessageFor(err));
        setStatus("idle");
        setActiveRoomId(null);
        resetRoomState();
        roomRef.current = null;
        return false;
      }
    },
    [
      disconnect,
      requestIdlePermission,
      handleDisconnected,
      onLocalSpeech,
      queueDeafenState,
      applyParticipantVolumes,
      setRemoteMuted,
      setRemoteDeafened,
      createKrispProcessor,
      applyInitialProcessor,
      closeVoiceAudioContext,
      syncParticipants,
      removeParticipant,
      speaking,
      setRemotePushToTalkIdle,
      syncLocalMicTrack,
      onTrackSubscribed,
      onTrackUnsubscribed,
      onLocalTrackUnpublished,
      onShareTrackPublished,
      onShareTrackUnpublished,
      onParticipantDisconnected,
      refreshLiveShares,
      applyInitialShares,
      hasWatchIntent,
      resetRoomState,
    ],
  );

  const returnToRoom = useCallback(async () => {
    const target = awayInfoRef.current ?? exitNoticeRef.current;
    if (target === null) return;

    const wasAway = awayInfoRef.current !== null;
    const connected = await connect(target.roomId, {
      micEnabled: target.micEnabled,
      deafen: target.deafen,
      hardMuted: target.hardMuted,
    });
    if (connected) {
      onReturnedRef.current?.();
      return;
    }
    if (wasAway) setStatus("away");
  }, [connect]);

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
      const transition = pushToTalkTransitionRef.current.then(() =>
        setMicEnabled(enabled, { silent: true }),
      );
      pushToTalkTransitionRef.current = transition.then(
        () => undefined,
        (err: unknown) => setError(microphoneToggleErrorMessageFor(err)),
      );
    },
    [setMicEnabled],
  );

  const setPushToTalkEnabled = useCallback(
    (enabled: boolean) => {
      pushToTalkEnabledRef.current = enabled;
      pushToTalkPressedRef.current = false;
      pushToTalkMicOpenRef.current = false;
      clearPushToTalkReleaseTimer(pushToTalkReleaseTimerRef);
      hardMutedRef.current = false;
      setHardMuted(false);
      setPushToTalkEnabledState(enabled);
      writePushToTalkEnabled(typeof localStorage === "undefined" ? null : localStorage, enabled);
      if (status === "connected") {
        queuePushToTalkMicrophoneState(!enabled && !deafenRef.current);
        publishPushToTalkIdleState(roomRef.current, enabled);
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

  const toggleHardMute = useCallback(() => {
    const muted = !hardMutedRef.current;
    hardMutedRef.current = muted;
    setHardMuted(muted);
    publishPushToTalkIdleState(roomRef.current, !muted);
    playVoiceActionSound(muted ? "mute" : "unmute");
    if (!muted) return;
    pushToTalkPressedRef.current = false;
    pushToTalkMicOpenRef.current = false;
    clearPushToTalkReleaseTimer(pushToTalkReleaseTimerRef);
    queuePushToTalkMicrophoneState(false);
  }, [queuePushToTalkMicrophoneState]);

  const toggleMic = useCallback(() => {
    if (deafenRef.current) {
      applyDeafen(false);
      return;
    }
    if (pushToTalkEnabledRef.current) {
      toggleHardMute();
      return;
    }
    setMicEnabled(!micOn).catch((err: unknown) => {
      setError(microphoneToggleErrorMessageFor(err));
    });
  }, [applyDeafen, micOn, setMicEnabled, toggleHardMute]);

  // --- Effects ---

  useEffect(() => {
    if (!pushToTalkEnabled || status !== "connected") return;

    const closeMicrophone = () => {
      clearPushToTalkReleaseTimer(pushToTalkReleaseTimerRef);
      if (!pushToTalkMicOpenRef.current) return;
      pushToTalkMicOpenRef.current = false;
      queuePushToTalkMicrophoneState(false);
    };
    const releaseMicrophone = () => {
      if (!pushToTalkPressedRef.current) return;
      pushToTalkPressedRef.current = false;
      const releaseDelayMs = getVoicePreferences().pushToTalkReleaseDelayMs;
      if (releaseDelayMs === 0) {
        closeMicrophone();
        return;
      }
      pushToTalkReleaseTimerRef.current = setTimeout(closeMicrophone, releaseDelayMs);
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
      if (deafenRef.current || hardMutedRef.current) return;
      clearPushToTalkReleaseTimer(pushToTalkReleaseTimerRef);
      pushToTalkPressedRef.current = true;
      if (pushToTalkMicOpenRef.current) return;
      pushToTalkMicOpenRef.current = true;
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
      pushToTalkPressedRef.current = false;
      closeMicrophone();
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
      stopIdleDetection();
      void roomRef.current?.disconnect();
      void closeVoiceAudioContext();
      roomRef.current = null;
    };
  }, [closeVoiceAudioContext]);

  const displayedMutedParticipants = useMemo(
    () => visibleMutedParticipants(mutedParticipants, pushToTalkIdleParticipants),
    [mutedParticipants, pushToTalkIdleParticipants],
  );
  const micEnabled = pushToTalkEnabled ? !hardMuted : micOn;

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
    micEnabled,
    volumes,
    screenShareVolumes,
    screenShareEnabled,
    screenShares,
    liveShares,
    watchingIdentities,
    watchShare,
    stopWatchingShare,
    micDevices,
    selectedDeviceId: selectedMic,
    noiseFilter,
    krispSupported,
    selfMonitor,
    pushToTalkEnabled,
    pushToTalkBinding,
    mutedParticipants: displayedMutedParticipants,
    deafenedParticipants,
    screenShareMutedParticipants,
    localPreview,
    deafen,
    error,
    connectionState,
    screenShareHealth,
    qualities,
    connectedAt,
    clearError,
    ensureKrispLoaded,
    connect,
    disconnect,
    awayInfo,
    exitNotice,
    goAway,
    leaveForInactivity,
    endAway,
    returnToRoom,
    getLastLocalSpeechAt,
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
