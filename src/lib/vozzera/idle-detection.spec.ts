import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createIdlePermissionGate,
  getIdleSnapshot,
  IDLE_THRESHOLD_MS,
  isIdleDetectionSupported,
  LOCK_GRACE_MS,
  lockDecisionAt,
  onIdleChange,
  refreshedActivityAt,
  requestIdleDetectionPermission,
  startIdleDetection,
  stopIdleDetection,
} from "@/lib/vozzera/idle-detection";
import type { IdlePermissionState, IdleSnapshot, LockContext } from "@/lib/vozzera/idle-detection";

type FakeIdleDetectorOptions = {
  userState?: string | null;
  screenState?: string | null;
  permission?: () => Promise<IdlePermissionState>;
  start?: (options: { threshold: number }) => Promise<void>;
};

type FakeIdleDetectorControl = {
  events: string[];
  thresholds: number[];
  report: (state: Partial<IdleSnapshot>) => void;
  changeListenerCount: () => number;
};

function installIdleDetector(options: FakeIdleDetectorOptions = {}): FakeIdleDetectorControl {
  const state: { userState: string | null; screenState: string | null } = {
    userState: options.userState ?? "active",
    screenState: options.screenState ?? "unlocked",
  };
  const changeListeners = new Set<() => void>();
  const control: FakeIdleDetectorControl = {
    events: [],
    thresholds: [],
    report: ({ userState, screenState }) => {
      state.userState = userState ?? state.userState;
      state.screenState = screenState ?? state.screenState;
      for (const listener of changeListeners) listener();
    },
    changeListenerCount: () => changeListeners.size,
  };
  class FakeIdleDetector {
    get userState() {
      return state.userState;
    }

    get screenState() {
      return state.screenState;
    }

    static requestPermission() {
      return (options.permission ?? (() => Promise.resolve<IdlePermissionState>("granted")))();
    }

    start(startOptions: { threshold: number }) {
      control.thresholds.push(startOptions.threshold);
      return (options.start ?? (() => Promise.resolve()))(startOptions);
    }

    addEventListener(type: string, listener: () => void) {
      control.events.push(`add:${type}`);
      if (type !== "change") return;
      changeListeners.add(listener);
    }

    removeEventListener(type: string, listener: () => void) {
      control.events.push(`remove:${type}`);
      if (type !== "change") return;
      changeListeners.delete(listener);
    }
  }
  (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector = FakeIdleDetector;
  return control;
}

function removeIdleDetector(): void {
  delete (globalThis as unknown as { IdleDetector?: unknown }).IdleDetector;
}

afterEach(() => {
  stopIdleDetection();
  removeIdleDetector();
});

const T0 = 1_000_000;

function idleSnapshot(screenState: string): IdleSnapshot {
  return { userState: "active", screenState };
}

describe("isIdleDetectionSupported", () => {
  it("is false without the constructor", () => {
    expect(isIdleDetectionSupported()).toBe(false);
  });

  it("is true with the constructor", () => {
    installIdleDetector();
    expect(isIdleDetectionSupported()).toBe(true);
  });
});

describe("idle snapshot", () => {
  it("returns null before the detector starts", () => {
    installIdleDetector();
    expect(getIdleSnapshot()).toBeNull();
  });

  it("starts with the idle threshold and exposes the state", () => {
    const control = installIdleDetector({ userState: "active", screenState: "unlocked" });
    startIdleDetection();
    expect(control.thresholds).toEqual([IDLE_THRESHOLD_MS]);
    expect(control.events).toContain("add:change");
    expect(getIdleSnapshot()).toEqual({ userState: "active", screenState: "unlocked" });
  });

  it("forgets the snapshot and removes the listener on stop", () => {
    const control = installIdleDetector();
    startIdleDetection();
    stopIdleDetection();
    expect(getIdleSnapshot()).toBeNull();
    expect(control.events).toContain("remove:change");
  });

  it("keeps a single detector instance", () => {
    const control = installIdleDetector();
    startIdleDetection();
    startIdleDetection();
    expect(control.thresholds).toHaveLength(1);
  });
});

describe("requestIdleDetectionPermission", () => {
  it("returns the browser state", async () => {
    installIdleDetector({ permission: () => Promise.resolve("granted") });
    await expect(requestIdleDetectionPermission()).resolves.toBe("granted");
  });

  it("never throws when the request rejects", async () => {
    installIdleDetector({ permission: () => Promise.reject(new Error("denied")) });
    await expect(requestIdleDetectionPermission()).resolves.toBe("denied");
  });

  it("reports denied without the API", async () => {
    await expect(requestIdleDetectionPermission()).resolves.toBe("denied");
  });
});

describe("onIdleChange", () => {
  it("notifies the listener synchronously when the screen locks", () => {
    const control = installIdleDetector();
    const received: IdleSnapshot[] = [];
    const unsubscribe = onIdleChange((snapshot) => received.push(snapshot));
    startIdleDetection();
    control.report({ screenState: "locked" });
    unsubscribe();
    expect(received).toEqual([{ userState: "active", screenState: "locked" }]);
  });

  it("notifies the listener synchronously when the screen unlocks", () => {
    const control = installIdleDetector({ screenState: "locked" });
    const received: IdleSnapshot[] = [];
    const unsubscribe = onIdleChange((snapshot) => received.push(snapshot));
    startIdleDetection();
    control.report({ screenState: "unlocked" });
    unsubscribe();
    expect(received).toEqual([{ userState: "active", screenState: "unlocked" }]);
  });

  it("stops delivering after unsubscribe", () => {
    const control = installIdleDetector();
    const received: IdleSnapshot[] = [];
    const unsubscribe = onIdleChange((snapshot) => received.push(snapshot));
    startIdleDetection();
    control.report({ screenState: "locked" });
    unsubscribe();
    control.report({ screenState: "unlocked" });
    expect(received).toEqual([{ userState: "active", screenState: "locked" }]);
  });

  it("drops the detector listener when detection stops", () => {
    const control = installIdleDetector();
    const received: IdleSnapshot[] = [];
    const unsubscribe = onIdleChange((snapshot) => received.push(snapshot));
    startIdleDetection();
    stopIdleDetection();
    control.report({ screenState: "locked" });
    unsubscribe();
    expect(received).toEqual([]);
    expect(control.changeListenerCount()).toBe(0);
  });
});

describe("createIdlePermissionGate", () => {
  it("requests once while the first request is pending", async () => {
    let resolveRequest: (state: IdlePermissionState) => void = () => undefined;
    const request = vi.fn(
      () =>
        new Promise<IdlePermissionState>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const gate = createIdlePermissionGate(request);

    gate.request();
    gate.request();

    expect(request).toHaveBeenCalledTimes(1);
    expect(gate.state).toBe("pending");

    resolveRequest("granted");
    await Promise.resolve();

    expect(gate.state).toBe("granted");
    gate.request();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not request again after a denial", async () => {
    const request = vi.fn(() => Promise.resolve<IdlePermissionState>("denied"));
    const gate = createIdlePermissionGate(request);
    gate.request();
    await Promise.resolve();
    gate.request();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("allows a new request while the state is prompt", async () => {
    const request = vi.fn(() => Promise.resolve<IdlePermissionState>("prompt"));
    const gate = createIdlePermissionGate(request);
    gate.request();
    await Promise.resolve();
    gate.request();
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("lockDecisionAt", () => {
  const alone: LockContext = { alone: true, live: false };
  const withOthers: LockContext = { alone: false, live: false };
  const sharing: LockContext = { alone: true, live: true };

  it("waits inside the grace and schedules the check at its end", () => {
    expect(lockDecisionAt(null, idleSnapshot("locked"), alone, T0)).toEqual({
      lockedSince: T0,
      action: null,
      checkAt: T0 + LOCK_GRACE_MS,
    });
    expect(
      lockDecisionAt(T0, idleSnapshot("locked"), alone, T0 + LOCK_GRACE_MS - 1).action,
    ).toBeNull();
  });

  it("leaves when alone at the end of the grace", () => {
    expect(lockDecisionAt(T0, idleSnapshot("locked"), alone, T0 + LOCK_GRACE_MS).action).toBe(
      "leave",
    );
  });

  it("goes away with others at the end of the grace", () => {
    expect(lockDecisionAt(T0, idleSnapshot("locked"), withOthers, T0 + LOCK_GRACE_MS).action).toBe(
      "away",
    );
  });

  it("cancels the grace on unlock", () => {
    expect(lockDecisionAt(T0, idleSnapshot("unlocked"), alone, T0 + 10_000)).toEqual({
      lockedSince: null,
      action: null,
      checkAt: null,
    });
  });

  it("never starts the grace while a live is running", () => {
    expect(lockDecisionAt(null, idleSnapshot("locked"), sharing, T0)).toEqual({
      lockedSince: null,
      action: null,
      checkAt: null,
    });
    expect(lockDecisionAt(T0, idleSnapshot("locked"), sharing, T0 + LOCK_GRACE_MS)).toEqual({
      lockedSince: null,
      action: null,
      checkAt: null,
    });
  });

  it("does nothing without a snapshot", () => {
    expect(lockDecisionAt(T0, null, alone, T0 + LOCK_GRACE_MS)).toEqual({
      lockedSince: null,
      action: null,
      checkAt: null,
    });
  });
});

describe("refreshedActivityAt", () => {
  it("refreshes the activity while the user is active", () => {
    expect(refreshedActivityAt(100, idleSnapshot("unlocked"), 900)).toBe(900);
  });

  it("keeps the previous moment while idle", () => {
    expect(refreshedActivityAt(100, { userState: "idle", screenState: "unlocked" }, 900)).toBe(100);
  });

  it("keeps the previous moment without a snapshot", () => {
    expect(refreshedActivityAt(100, null, 900)).toBe(100);
  });
});
