import { describe, expect, it } from "vitest";

import { createAwayIntentTracker } from "@/lib/vozzera/away-intent";
import type { AwayIntent } from "@/lib/vozzera/away-intent";

const idle: AwayIntent = { roomId: "r1", reason: "idle" };
const connection: AwayIntent = { roomId: "r1", reason: "connection" };
const enter = (intent: AwayIntent) => ({ type: "enter", intent });
const leave = { type: "leave" };

describe("createAwayIntentTracker", () => {
  it("sends enter when the intent is set on an open socket", () => {
    expect(createAwayIntentTracker().set(idle, true)).toEqual([enter(idle)]);
  });

  it("sends nothing when the intent is set while the socket is closed", () => {
    expect(createAwayIntentTracker().set(idle, false)).toEqual([]);
  });

  it("sends nothing for an unchanged intent", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    expect(tracker.set({ ...idle }, true)).toEqual([]);
  });

  it("sends enter again when the reason changes", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    expect(tracker.set(connection, true)).toEqual([enter(connection)]);
  });

  it("sends leave when clearing an intent that was sent", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    expect(tracker.set(null, true)).toEqual([leave]);
  });

  it("never sends leave without a prior enter", () => {
    const tracker = createAwayIntentTracker();
    expect(tracker.set(null, true)).toEqual([]);
    tracker.set(idle, false);
    expect(tracker.set(null, true)).toEqual([]);
    expect(tracker.onOpen()).toEqual([]);
  });

  it("re-sends enter on open", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, false);
    expect(tracker.onOpen()).toEqual([enter(idle)]);
    expect(tracker.onOpen()).toEqual([enter(idle)]);
  });

  it("sends a pending leave once on open", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    expect(tracker.set(null, false)).toEqual([]);
    expect(tracker.onOpen()).toEqual([leave]);
    expect(tracker.onOpen()).toEqual([]);
  });

  it("drops the pending leave when a new intent is set", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    tracker.set(null, false);
    expect(tracker.set(connection, false)).toEqual([]);
    expect(tracker.onOpen()).toEqual([enter(connection)]);
    expect(tracker.onOpen()).toEqual([enter(connection)]);
  });

  it("re-sends enter on resync only while an intent is set", () => {
    const tracker = createAwayIntentTracker();
    expect(tracker.onResync()).toEqual([]);
    tracker.set(idle, true);
    expect(tracker.onResync()).toEqual([enter(idle)]);
    tracker.set(null, true);
    expect(tracker.onResync()).toEqual([]);
  });

  it("drops the intent without sending leave", () => {
    const tracker = createAwayIntentTracker();
    tracker.set(idle, true);
    tracker.drop();
    expect(tracker.set(null, true)).toEqual([]);
    expect(tracker.onOpen()).toEqual([]);
    expect(tracker.onResync()).toEqual([]);
  });
});
