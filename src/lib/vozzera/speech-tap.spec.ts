import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { MIC_TRACK_RESTARTED_EVENT, onMicTrackRestarted } from "./speech-tap";

describe("onMicTrackRestarted", () => {
  it("calls the listener when the track restarts", () => {
    const track = new EventEmitter();
    const listener = vi.fn();
    onMicTrackRestarted(track, listener);
    track.emit(MIC_TRACK_RESTARTED_EVENT);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops listening after cleanup", () => {
    const track = new EventEmitter();
    const listener = vi.fn();
    onMicTrackRestarted(track, listener)();
    track.emit(MIC_TRACK_RESTARTED_EVENT);
    expect(listener).not.toHaveBeenCalled();
  });
});
