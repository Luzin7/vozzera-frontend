import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LocalAudioTrack } from "livekit-client";
import { createSpeakingMonitor } from "./speaking-monitor";
import { setMicLevelDb, setSpeakingIdentities } from "./speaking-store";
import { attachRemoteSpeechTap, createLocalSpeechTap, onMicTrackRestarted } from "./speech-tap";
import { getVoicePreferences } from "./voice-preferences";
import { SPEECH_POLL_INTERVAL_MS, speechThresholdsFor } from "./voice";

type Props = {
  connected: boolean;
  micOpen: boolean;
  localMicTrack: LocalAudioTrack | null;
  micProcessorRevision: number;
  audioContextRef: { readonly current: AudioContext | null };
  getLocalIdentity: () => string | undefined;
  onLocalSpeech: () => void;
};

export function useSpeakingDetection({
  connected,
  micOpen,
  localMicTrack,
  micProcessorRevision,
  audioContextRef,
  getLocalIdentity,
  onLocalSpeech,
}: Props) {
  const onLocalSpeechRef = useRef(onLocalSpeech);
  onLocalSpeechRef.current = onLocalSpeech;

  const monitorRef = useRef<ReturnType<typeof createSpeakingMonitor> | null>(null);
  monitorRef.current ??= createSpeakingMonitor({
    now: () => performance.now(),
    localThresholds: () => speechThresholdsFor(getVoicePreferences().sensitivity),
    onSpeakingChange: setSpeakingIdentities,
    onLevel: setMicLevelDb,
    onLocalSpeech: () => onLocalSpeechRef.current(),
  });
  const monitor = monitorRef.current;
  const [trackRestarts, setTrackRestarts] = useState(0);

  useEffect(() => {
    if (!localMicTrack) return;
    return onMicTrackRestarted(localMicTrack, () => setTrackRestarts((count) => count + 1));
  }, [localMicTrack]);

  useEffect(() => {
    if (!connected) return;
    const timer = setInterval(() => {
      monitor.setAudioRunning(audioContextRef.current?.state === "running");
      monitor.tick();
    }, SPEECH_POLL_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      monitor.reset();
    };
  }, [connected, monitor, audioContextRef]);

  useEffect(() => {
    monitor.setLocalOpen(connected && micOpen);
  }, [connected, micOpen, monitor]);

  useEffect(() => {
    const context = audioContextRef.current;
    const identity = getLocalIdentity();
    if (!connected || !localMicTrack || !context || !identity) return;
    monitor.setLocal(identity, createLocalSpeechTap(context, localMicTrack.mediaStreamTrack));
    return () => monitor.setLocal(identity, null);
  }, [
    connected,
    localMicTrack,
    micProcessorRevision,
    trackRestarts,
    audioContextRef,
    getLocalIdentity,
    monitor,
  ]);

  const addRemoteMicrophone = useCallback(
    (identity: string, track: unknown) => {
      const context = audioContextRef.current;
      if (!context) return;
      const tap = attachRemoteSpeechTap(context, track);
      if (tap) monitor.addRemote(identity, tap, track);
    },
    [audioContextRef, monitor],
  );

  const removeRemote = useCallback(
    (identity: string, track?: unknown) => monitor.removeRemote(identity, track),
    [monitor],
  );
  const setServerSpeakers = useCallback(
    (identities: string[]) => monitor.setServerSpeakers(identities),
    [monitor],
  );
  const reset = useCallback(() => monitor.reset(), [monitor]);

  return useMemo(
    () => ({ addRemoteMicrophone, removeRemote, setServerSpeakers, reset }),
    [addRemoteMicrophone, removeRemote, setServerSpeakers, reset],
  );
}
