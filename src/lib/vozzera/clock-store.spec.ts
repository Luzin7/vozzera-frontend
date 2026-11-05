import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeClock } from "@/lib/vozzera/clock-store";

describe("clock-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts one interval for three subscribers", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    const unsubscribes = [
      subscribeClock(() => {}),
      subscribeClock(() => {}),
      subscribeClock(() => {}),
    ];

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  });

  it("clears the interval only after the last unsubscribe", () => {
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const first = subscribeClock(() => {});
    const second = subscribeClock(() => {});

    first();
    expect(clearIntervalSpy).not.toHaveBeenCalled();
    second();
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it("notifies every subscriber on each tick", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeClock(listener);

    vi.advanceTimersByTime(3000);

    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});
