import { useSyncExternalStore } from "react";

type Listener = () => void;

const TICK_MS = 1000;

const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = Date.now();

function tick(): void {
  now = Date.now();
  for (const listener of listeners) listener();
}

export function subscribeClock(listener: Listener): () => void {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(tick, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || timer === null) return;
    clearInterval(timer);
    timer = null;
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => now,
    () => 0,
  );
}
