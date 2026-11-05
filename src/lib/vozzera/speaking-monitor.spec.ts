import { describe, expect, it, vi } from "vitest";

import { createSpeakingMonitor } from "./speaking-monitor";
import type { SpeechTap } from "./speaking-monitor";

function fakeTap(
  level = -Infinity,
): SpeechTap & { level: number; dispose: ReturnType<typeof vi.fn> } {
  const tap = {
    level,
    readDb: () => tap.level,
    dispose: vi.fn(),
  };
  return tap;
}

function setup() {
  let now = 0;
  const speaking: string[][] = [];
  const onLocalSpeech = vi.fn();
  const monitor = createSpeakingMonitor({
    now: () => now,
    localThresholds: () => ({ onDb: -50, stayDb: -55 }),
    onSpeakingChange: (identities) => speaking.push([...identities].sort()),
    onLevel: vi.fn(),
    onLocalSpeech,
  });
  const tick = (ms = 40) => {
    now += ms;
    monitor.tick();
  };
  return { monitor, tick, speaking, onLocalSpeech, last: () => speaking.at(-1) };
}

describe("createSpeakingMonitor", () => {
  it("lights the local identity from the local tap and reports local speech", () => {
    const { monitor, tick, last, onLocalSpeech } = setup();
    const tap = fakeTap(-30);
    monitor.setLocal("me", tap);
    monitor.setLocalOpen(true);
    monitor.setAudioRunning(true);
    tick();
    expect(last()).toEqual(["me"]);
    expect(onLocalSpeech).toHaveBeenCalled();
  });

  it("keeps the local ring off while the mic is gated", () => {
    const { monitor, tick, last } = setup();
    monitor.setLocal("me", fakeTap(-30));
    monitor.setLocalOpen(false);
    monitor.setAudioRunning(true);
    tick();
    expect(last()).toBeUndefined();
  });

  it("keeps the local ring off while the audio context is not running", () => {
    const { monitor, tick, last, onLocalSpeech } = setup();
    monitor.setLocal("me", fakeTap(-30));
    monitor.setLocalOpen(true);
    monitor.setAudioRunning(false);
    tick();
    expect(last()).toBeUndefined();
    expect(onLocalSpeech).not.toHaveBeenCalled();
  });

  it("ignores a stale unsubscribe from an older track of the same person", () => {
    const { monitor, tick, last } = setup();
    const oldTrack = {};
    const newTrack = {};
    const newTap = fakeTap(-30);
    monitor.addRemote("ana", fakeTap(-90), oldTrack);
    monitor.addRemote("ana", newTap, newTrack);
    monitor.setAudioRunning(true);
    monitor.removeRemote("ana", oldTrack);
    tick();
    expect(newTap.dispose).not.toHaveBeenCalled();
    expect(last()).toEqual(["ana"]);
  });

  it("removes the remote when the owner track matches", () => {
    const { monitor } = setup();
    const track = {};
    const tap = fakeTap();
    monitor.addRemote("ana", tap, track);
    monitor.removeRemote("ana", track);
    expect(tap.dispose).toHaveBeenCalledTimes(1);
  });

  it("ignores the server speaker list for the local identity", () => {
    const { monitor, tick, last } = setup();
    monitor.setLocal("me", fakeTap(-90));
    monitor.setLocalOpen(true);
    monitor.setAudioRunning(true);
    monitor.setServerSpeakers(["me"]);
    tick();
    expect(last()).toBeUndefined();
  });

  it("uses the remote analyser once it heard signal, ignoring the server list", () => {
    const { monitor, tick, last } = setup();
    const tap = fakeTap(-30);
    monitor.addRemote("ana", tap);
    monitor.setAudioRunning(true);
    monitor.setServerSpeakers([]);
    tick();
    expect(last()).toEqual(["ana"]);
    tap.level = -90;
    tick(100);
    tick(200);
    expect(last()).toEqual([]);
  });

  it("falls back to the server list before the analyser heard any signal", () => {
    const { monitor, tick, last } = setup();
    monitor.addRemote("ana", fakeTap(-Infinity));
    monitor.setAudioRunning(true);
    monitor.setServerSpeakers(["ana"]);
    tick();
    expect(last()).toEqual(["ana"]);
  });

  it("falls back to the server list while the audio context is not running", () => {
    const { monitor, tick, last } = setup();
    monitor.addRemote("ana", fakeTap(-90));
    monitor.setAudioRunning(false);
    monitor.setServerSpeakers(["ana"]);
    tick();
    expect(last()).toEqual(["ana"]);
  });

  it("uses the server list for remotes without an analyser", () => {
    const { monitor, tick, last } = setup();
    monitor.setServerSpeakers(["beto"]);
    tick();
    expect(last()).toEqual(["beto"]);
  });

  it("disposes a remote tap when removed and when replaced", () => {
    const { monitor } = setup();
    const first = fakeTap();
    const second = fakeTap();
    monitor.addRemote("ana", first);
    monitor.addRemote("ana", second);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    monitor.removeRemote("ana");
    expect(second.dispose).toHaveBeenCalledTimes(1);
  });

  it("clears everyone and disposes taps on reset", () => {
    const { monitor, tick, last } = setup();
    const tap = fakeTap(-30);
    monitor.addRemote("ana", tap);
    monitor.setAudioRunning(true);
    tick();
    monitor.reset();
    expect(tap.dispose).toHaveBeenCalled();
    expect(last()).toEqual([]);
  });

  it("does not notify when nothing changed", () => {
    const { monitor, tick, speaking } = setup();
    monitor.addRemote("ana", fakeTap(-30));
    monitor.setAudioRunning(true);
    tick();
    tick();
    tick();
    expect(speaking).toHaveLength(1);
  });
});
