import { useSyncExternalStore } from "react";

import {
  DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS,
  SPEECH_ON_DB,
  readPushToTalkReleaseDelayMs,
  readSpeechSensitivity,
  writePushToTalkReleaseDelayMs,
  writeSpeechSensitivity,
} from "./voice";
import type { SpeechSensitivity } from "./voice";

export type VoicePreferences = {
  sensitivity: SpeechSensitivity;
  pushToTalkReleaseDelayMs: number;
};

const listeners = new Set<Listener>();
type Listener = () => void;

let snapshot: VoicePreferences | null = null;

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function getVoicePreferences(): VoicePreferences {
  snapshot ??= {
    sensitivity: readSpeechSensitivity(storage()),
    pushToTalkReleaseDelayMs: readPushToTalkReleaseDelayMs(storage()),
  };
  return snapshot;
}

export function updateVoicePreferences(patch: Partial<VoicePreferences>): void {
  const next = { ...getVoicePreferences(), ...patch };
  snapshot = next;
  writeSpeechSensitivity(storage(), next.sensitivity);
  writePushToTalkReleaseDelayMs(storage(), next.pushToTalkReleaseDelayMs);
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const DEFAULT_VOICE_PREFERENCES: VoicePreferences = {
  sensitivity: { auto: true, thresholdDb: SPEECH_ON_DB },
  pushToTalkReleaseDelayMs: DEFAULT_PUSH_TO_TALK_RELEASE_DELAY_MS,
};

export function useVoicePreferences(): VoicePreferences {
  return useSyncExternalStore(subscribe, getVoicePreferences, () => DEFAULT_VOICE_PREFERENCES);
}
