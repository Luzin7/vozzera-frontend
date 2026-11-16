// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stopIdleDetection } from "@/lib/vozzera/idle-detection";
import { useVoice } from "@/lib/vozzera/useVoice";

vi.mock("@/lib/vozzera/idle-detection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vozzera/idle-detection")>();
  return {
    ...actual,
    startIdleDetection: vi.fn(actual.startIdleDetection),
    stopIdleDetection: vi.fn(actual.stopIdleDetection),
  };
});

type PendingPermission = { calls: number };

function installPendingIdleDetector(): PendingPermission {
  const counter = { calls: 0 };
  class FakeIdleDetector {
    static requestPermission() {
      counter.calls += 1;
      return new Promise<"granted">(() => undefined);
    }

    start() {
      return Promise.resolve();
    }

    addEventListener() {}

    removeEventListener() {}
  }
  (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector = FakeIdleDetector;
  return counter;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector;
});

describe("useVoice idle detection lifecycle", () => {
  it("requests the permission once for two joins while the prompt is pending", async () => {
    const permission = installPendingIdleDetector();
    const { result } = renderHook(() => useVoice());

    await act(async () => {
      void result.current.connect("r1").catch(() => undefined);
      void result.current.connect("r1").catch(() => undefined);
    });

    expect(permission.calls).toBe(1);
  });

  it("stops the detector on disconnect", async () => {
    const { result } = renderHook(() => useVoice());

    await act(async () => {
      await result.current.disconnect();
    });

    expect(vi.mocked(stopIdleDetection)).toHaveBeenCalled();
  });
});
