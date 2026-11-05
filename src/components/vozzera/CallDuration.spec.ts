import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CallDuration } from "@/components/vozzera/CallDuration";

describe("CallDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders nothing and subscribes to no clock when startedAt is null", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");

    expect(CallDuration({ startedAt: null })).toBeNull();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
