import { afterEach, describe, expect, it, vi } from "vitest";

import {
  playVoiceActionSound,
  SILENT_GAIN,
  VOICE_SOUND_ATTACK_SECONDS,
  VOICE_SOUND_RELEASE_SECONDS,
  voiceActionNotesFor,
  type VoiceActionNote,
  type VoiceActionSound,
} from "./voice-sounds";

const MAX_FREQUENCY_HZ = 380;
const MAX_PEAK_GAIN = 0.13;
const MIN_ATTACK_SECONDS = 0.01;
const MIN_RELEASE_SECONDS = 0.08;

const ACTIONS: VoiceActionSound[] = [
  "join",
  "leave",
  "mute",
  "unmute",
  "screen-share-start",
  "screen-share-stop",
];

const frequenciesOf = (action: VoiceActionSound) =>
  voiceActionNotesFor(action).map((note) => note.frequency);

const EXPECTED_PROFILES: Record<VoiceActionSound, VoiceActionNote[]> = {
  join: [
    { frequency: 220, startsAt: 0, duration: 0.14, gain: 0.12 },
    { frequency: 330, startsAt: 0.11, duration: 0.2, gain: 0.13 },
  ],
  leave: [
    { frequency: 310, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 195, startsAt: 0.11, duration: 0.2, gain: 0.12 },
  ],
  mute: [{ frequency: 155, startsAt: 0, duration: 0.18, gain: 0.125 }],
  unmute: [{ frequency: 260, startsAt: 0, duration: 0.18, gain: 0.125 }],
  "screen-share-start": [
    { frequency: 240, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 360, startsAt: 0.09, duration: 0.22, gain: 0.13 },
  ],
  "screen-share-stop": [
    { frequency: 340, startsAt: 0, duration: 0.14, gain: 0.11 },
    { frequency: 210, startsAt: 0.09, duration: 0.22, gain: 0.12 },
  ],
};

describe("voiceActionNotesFor", () => {
  it.each(ACTIONS)("returns the exact profile for %s", (action) => {
    expect(voiceActionNotesFor(action)).toEqual(EXPECTED_PROFILES[action]);
  });

  it.each(ACTIONS)("returns an audible profile for %s", (action) => {
    const notes = voiceActionNotesFor(action);

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((note) => note.frequency > 0)).toBe(true);
    expect(notes.every((note) => note.duration > 0)).toBe(true);
    expect(notes.every((note) => note.gain > 0)).toBe(true);
  });

  it.each(ACTIONS)("keeps %s low and quiet", (action) => {
    const notes = voiceActionNotesFor(action);

    expect(Math.max(...notes.map((note) => note.frequency))).toBeLessThanOrEqual(MAX_FREQUENCY_HZ);
    expect(Math.max(...notes.map((note) => note.gain))).toBeLessThanOrEqual(MAX_PEAK_GAIN);
  });

  it.each(ACTIONS)("fits attack and release inside every %s note", (action) => {
    const notes = voiceActionNotesFor(action);

    expect(
      notes.every(
        (note) => note.duration >= VOICE_SOUND_ATTACK_SECONDS + VOICE_SOUND_RELEASE_SECONDS,
      ),
    ).toBe(true);
  });

  it("uses a soft attack and release", () => {
    expect(VOICE_SOUND_ATTACK_SECONDS).toBeGreaterThanOrEqual(MIN_ATTACK_SECONDS);
    expect(VOICE_SOUND_RELEASE_SECONDS).toBeGreaterThanOrEqual(MIN_RELEASE_SECONDS);
  });

  it("returns a copy that cannot change the shared profile", () => {
    const notes = voiceActionNotesFor("join");
    const [firstNote] = notes;
    if (!firstNote) throw new Error("Expected a join sound note");
    firstNote.frequency = 1;

    expect(frequenciesOf("join")).toEqual([220, 330]);
  });

  it.each(["join", "screen-share-start"] as const)("rises for %s", (action) => {
    const [first = 0, second = 0] = frequenciesOf(action);

    expect(second).toBeGreaterThan(first);
  });

  it.each(["leave", "screen-share-stop"] as const)("falls for %s", (action) => {
    const [first = 0, second = 0] = frequenciesOf(action);

    expect(second).toBeLessThan(first);
  });

  it("keeps unmute above mute", () => {
    expect(frequenciesOf("unmute")[0]).toBeGreaterThan(frequenciesOf("mute")[0] ?? 0);
  });
});

describe("playVoiceActionSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("schedules a soft attack and release on the gain", () => {
    const gainCalls: unknown[][] = [];
    const gainParam = {
      setValueAtTime: (...args: unknown[]) => gainCalls.push(["set", ...args]),
      linearRampToValueAtTime: (...args: unknown[]) => gainCalls.push(["linear", ...args]),
      exponentialRampToValueAtTime: (...args: unknown[]) => gainCalls.push(["exp", ...args]),
    };
    const currentTime = 1;
    class FakeAudioContext {
      currentTime = currentTime;
      destination = {};
      state = "running";
      createOscillator = () => ({
        connect: () => undefined,
        frequency: { setValueAtTime: () => undefined },
        start: () => undefined,
        stop: () => undefined,
        type: "",
      });
      createGain = () => ({ connect: () => undefined, gain: gainParam });
      close = () => Promise.resolve();
    }
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });

    playVoiceActionSound("mute");

    const [note] = EXPECTED_PROFILES.mute;
    if (!note) throw new Error("Expected a mute note");
    const start = currentTime + note.startsAt;
    const end = start + note.duration;
    expect(gainCalls).toEqual([
      ["set", SILENT_GAIN, start],
      ["linear", note.gain, start + VOICE_SOUND_ATTACK_SECONDS],
      ["set", note.gain, end - VOICE_SOUND_RELEASE_SECONDS],
      ["exp", SILENT_GAIN, end],
    ]);
  });

  it("reuses one audio context across plays and never closes it", async () => {
    vi.resetModules();
    const { playVoiceActionSound: play } = await import("./voice-sounds");
    const created: FakeSharedAudioContext[] = [];
    class FakeSharedAudioContext {
      currentTime = 0;
      destination = {};
      state = "running";
      resume = vi.fn(() => Promise.resolve());
      close = vi.fn(() => Promise.resolve());
      createOscillator = () => ({
        connect: () => undefined,
        frequency: { setValueAtTime: () => undefined },
        start: () => undefined,
        stop: () => undefined,
        type: "",
      });
      createGain = () => ({
        connect: () => undefined,
        gain: {
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
      });
      constructor() {
        created.push(this);
      }
    }
    vi.stubGlobal("window", { AudioContext: FakeSharedAudioContext });

    play("join");
    play("leave");

    expect(created).toHaveLength(1);
    expect(created[0]?.close).not.toHaveBeenCalled();
  });

  it("drops the sound and swallows the rejection when the context stays suspended", async () => {
    vi.resetModules();
    const { playVoiceActionSound: play } = await import("./voice-sounds");
    const createOscillator = vi.fn();
    class SuspendedAudioContext {
      currentTime = 0;
      destination = {};
      state = "suspended";
      resume = vi.fn(() => Promise.reject(new Error("blocked")));
      createOscillator = createOscillator;
      createGain = vi.fn();
    }
    vi.stubGlobal("window", { AudioContext: SuspendedAudioContext });

    play("join");
    await Promise.resolve();

    expect(createOscillator).not.toHaveBeenCalled();
  });
});
