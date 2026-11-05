import { AUTOMATIC_SPEECH_THRESHOLDS, SILENT_SPEECH_STATE, nextSpeechState } from "./voice";
import type { SpeechState, SpeechThresholds } from "./voice";

export type SpeechTap = {
  readDb: () => number;
  dispose: () => void;
};

type SpeakingMonitorDeps = {
  now: () => number;
  localThresholds: () => SpeechThresholds;
  onSpeakingChange: (identities: ReadonlySet<string>) => void;
  onLevel: (levelDb: number) => void;
  onLocalSpeech: () => void;
};

type RemoteEntry = { tap: SpeechTap; owner: unknown; state: SpeechState; hasSignal: boolean };

const SIGNAL_FLOOR_DB = -100;

export function createSpeakingMonitor(deps: SpeakingMonitorDeps) {
  const remotes = new Map<string, RemoteEntry>();
  let local: { identity: string; tap: SpeechTap; state: SpeechState } | null = null;
  let localOpen = false;
  let audioRunning = false;
  let serverSpeakers = new Set<string>();
  let published: ReadonlySet<string> = new Set();

  function publish(next: Set<string>): void {
    const unchanged = next.size === published.size && [...next].every((id) => published.has(id));
    if (unchanged) return;
    published = next;
    deps.onSpeakingChange(next);
  }

  function readLocal(now: number, speaking: Set<string>): void {
    if (!local) return;
    if (!localOpen || !audioRunning) {
      local.state = SILENT_SPEECH_STATE;
      deps.onLevel(-Infinity);
      return;
    }
    const levelDb = local.tap.readDb();
    deps.onLevel(levelDb);
    local.state = nextSpeechState(local.state, levelDb, now, deps.localThresholds());
    if (!local.state.active) return;
    speaking.add(local.identity);
    deps.onLocalSpeech();
  }

  function readRemote(identity: string, entry: RemoteEntry, now: number, speaking: Set<string>) {
    const levelDb = entry.tap.readDb();
    if (levelDb > SIGNAL_FLOOR_DB) entry.hasSignal = true;
    entry.state = nextSpeechState(entry.state, levelDb, now, AUTOMATIC_SPEECH_THRESHOLDS);
    const analyserIsAuthority = entry.hasSignal && audioRunning;
    if (analyserIsAuthority ? entry.state.active : serverSpeakers.has(identity)) {
      speaking.add(identity);
    }
  }

  function tick(): void {
    const now = deps.now();
    const speaking = new Set<string>();
    readLocal(now, speaking);
    for (const [identity, entry] of remotes) readRemote(identity, entry, now, speaking);
    for (const identity of serverSpeakers) {
      if (!remotes.has(identity) && identity !== local?.identity) speaking.add(identity);
    }
    publish(speaking);
  }

  return {
    tick,
    setLocal(identity: string, tap: SpeechTap | null): void {
      local?.tap.dispose();
      local = tap ? { identity, tap, state: SILENT_SPEECH_STATE } : null;
    },
    setLocalOpen(open: boolean): void {
      localOpen = open;
    },
    setAudioRunning(running: boolean): void {
      audioRunning = running;
    },
    addRemote(identity: string, tap: SpeechTap, owner?: unknown): void {
      remotes.get(identity)?.tap.dispose();
      remotes.set(identity, { tap, owner, state: SILENT_SPEECH_STATE, hasSignal: false });
    },
    removeRemote(identity: string, owner?: unknown): void {
      const entry = remotes.get(identity);
      if (entry && owner !== undefined && entry.owner !== owner) return;
      entry?.tap.dispose();
      remotes.delete(identity);
      serverSpeakers.delete(identity);
    },
    setServerSpeakers(identities: string[]): void {
      serverSpeakers = new Set(identities);
    },
    reset(): void {
      local?.tap.dispose();
      local = null;
      for (const entry of remotes.values()) entry.tap.dispose();
      remotes.clear();
      serverSpeakers = new Set();
      localOpen = false;
      deps.onLevel(-Infinity);
      publish(new Set());
    },
  };
}

export type SpeakingMonitor = ReturnType<typeof createSpeakingMonitor>;
