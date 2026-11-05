import { useSyncExternalStore } from "react";

type Listener = () => void;

let speakingIdentities: ReadonlySet<string> = new Set();
const speakingListeners = new Set<Listener>();

let micLevelDb = -Infinity;
const micLevelListeners = new Set<Listener>();

function emit(listeners: Set<Listener>): void {
  for (const listener of listeners) listener();
}

function subscribeTo(listeners: Set<Listener>) {
  return (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
}

const subscribeSpeaking = subscribeTo(speakingListeners);
const subscribeMicLevel = subscribeTo(micLevelListeners);

export function setSpeakingIdentities(next: ReadonlySet<string>): void {
  speakingIdentities = next;
  emit(speakingListeners);
}

export function setMicLevelDb(levelDb: number): void {
  const rounded = Number.isFinite(levelDb) ? Math.round(levelDb) : -Infinity;
  if (rounded === micLevelDb) return;
  micLevelDb = rounded;
  emit(micLevelListeners);
}

export function useIsSpeaking(identity: string): boolean {
  return useSyncExternalStore(
    subscribeSpeaking,
    () => speakingIdentities.has(identity),
    () => false,
  );
}

export function useMicLevelDb(): number {
  return useSyncExternalStore(
    subscribeMicLevel,
    () => micLevelDb,
    () => -Infinity,
  );
}
