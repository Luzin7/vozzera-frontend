// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AwayPresence } from "@/lib/vozzera/away";
import type { CallParticipant } from "@/lib/vozzera/call-participants";
import type { VoicePresence } from "@/lib/vozzera/chat";
import { LOCK_GRACE_MS, startIdleDetection, stopIdleDetection } from "@/lib/vozzera/idle-detection";
import { useInactivity } from "@/lib/vozzera/use-inactivity";
import type { VoiceStatus } from "@/lib/vozzera/useVoice";

const T0 = 1_000_000;
const LOCAL: CallParticipant = { identity: "me", name: "Eu", isLocal: true };
const REMOTE: CallParticipant = { identity: "other", name: "Outra", isLocal: false };

type HarnessProps = {
  alone: boolean;
  live: boolean;
  onLeave: () => void;
  onAway: () => void;
};

function useInactivityHarness({ alone, live, onLeave, onAway }: HarnessProps) {
  const [status, setStatus] = useState<VoiceStatus>("connected");
  const awayPresenceRef = useRef<AwayPresence>({});
  const voicePresenceRef = useRef<VoicePresence>({});

  useInactivity({
    enabled: true,
    voice: {
      status,
      activeRoomId: "r1",
      participants: alone ? [LOCAL] : [LOCAL, REMOTE],
      screenShareEnabled: live,
      watchingIdentities: new Set<string>(),
      connectedAt: T0,
      awayInfo: null,
      getLastLocalSpeechAt: () => 0,
      goAway: async () => {
        onAway();
        setStatus("away");
      },
      leaveForInactivity: async () => {
        onLeave();
        setStatus("idle");
      },
      endAway: () => undefined,
    },
    currentUserId: "me",
    awayPresenceRef,
    voicePresenceRef,
    notificationsEnabled: false,
    miniWindowContainer: null,
    setAwayIntent: () => undefined,
    dropAwayIntent: () => undefined,
    resendAwayIntent: () => undefined,
  });
}

type IdleControl = {
  report: (state: { userState?: string; screenState?: string }) => void;
};

function installIdleDetector(
  initial: { userState?: string; screenState?: string } = {},
): IdleControl {
  const state = {
    userState: initial.userState ?? "idle",
    screenState: initial.screenState ?? "unlocked",
  };
  const listeners = new Set<() => void>();
  const control: IdleControl = {
    report: (next) => {
      state.userState = next.userState ?? state.userState;
      state.screenState = next.screenState ?? state.screenState;
      for (const listener of listeners) listener();
    },
  };

  class FakeIdleDetector {
    get userState() {
      return state.userState;
    }

    get screenState() {
      return state.screenState;
    }

    static requestPermission() {
      return Promise.resolve("granted" as const);
    }

    start() {
      return Promise.resolve();
    }

    addEventListener(type: string, listener: () => void) {
      if (type === "change") listeners.add(listener);
    }

    removeEventListener(type: string, listener: () => void) {
      if (type === "change") listeners.delete(listener);
    }
  }

  (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector = FakeIdleDetector;
  return control;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

afterEach(() => {
  cleanup();
  stopIdleDetection();
  delete (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector;
  vi.useRealTimers();
});

describe("useInactivity lock grace", () => {
  it("acts once at the end of the grace when alone", () => {
    const idle = installIdleDetector();
    startIdleDetection();
    const onLeave = vi.fn();
    const onAway = vi.fn();
    renderHook(() => useInactivityHarness({ alone: true, live: false, onLeave, onAway }));

    act(() => idle.report({ screenState: "locked" }));
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS - 1));
    expect(onLeave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onAway).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("goes away at the end of the grace with others", () => {
    const idle = installIdleDetector();
    startIdleDetection();
    const onLeave = vi.fn();
    const onAway = vi.fn();
    renderHook(() => useInactivityHarness({ alone: false, live: false, onLeave, onAway }));

    act(() => idle.report({ screenState: "locked" }));
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS));

    expect(onAway).toHaveBeenCalledTimes(1);
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("cancels the grace when the screen unlocks before its end", () => {
    const idle = installIdleDetector();
    startIdleDetection();
    const onLeave = vi.fn();
    const onAway = vi.fn();
    renderHook(() => useInactivityHarness({ alone: true, live: false, onLeave, onAway }));

    act(() => idle.report({ screenState: "locked" }));
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS - 1));
    act(() => idle.report({ screenState: "unlocked" }));
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS));

    expect(onLeave).not.toHaveBeenCalled();
    expect(onAway).not.toHaveBeenCalled();
  });

  it("never starts the grace while a live is running", () => {
    const idle = installIdleDetector();
    startIdleDetection();
    const onLeave = vi.fn();
    const onAway = vi.fn();
    const { rerender } = renderHook((props: HarnessProps) => useInactivityHarness(props), {
      initialProps: { alone: false, live: true, onLeave, onAway },
    });

    act(() => idle.report({ screenState: "locked" }));
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS * 20));
    expect(onLeave).not.toHaveBeenCalled();
    expect(onAway).not.toHaveBeenCalled();

    rerender({ alone: false, live: false, onLeave, onAway });
    act(() => vi.advanceTimersByTime(LOCK_GRACE_MS - 1));
    expect(onAway).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onAway).toHaveBeenCalledTimes(1);
  });
});
