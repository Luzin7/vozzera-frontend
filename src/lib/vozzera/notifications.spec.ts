import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canNotify,
  initialNotificationsEnabled,
  NOTIFICATIONS_NUDGE_STORAGE_KEY,
  playMessageSound,
  NOTIFICATIONS_STORAGE_KEY,
  readNotificationsEnabled,
  readNotificationsNudgeAsked,
  readSoundEnabled,
  shouldShowNotificationsNudge,
  SOUND_STORAGE_KEY,
  writeNotificationsEnabled,
  writeNotificationsNudgeAsked,
  writeSoundEnabled,
} from "./notifications";
import type { NotificationStorage } from "./notifications";

function memoryStorage(): NotificationStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("readNotificationsEnabled", () => {
  it("returns null when nothing is stored", () => {
    expect(readNotificationsEnabled(memoryStorage())).toBeNull();
  });

  it("returns true when stored as 1", () => {
    const storage = memoryStorage();
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, "1");

    expect(readNotificationsEnabled(storage)).toBe(true);
  });

  it("returns false when stored as 0", () => {
    const storage = memoryStorage();
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, "0");

    expect(readNotificationsEnabled(storage)).toBe(false);
  });

  it("returns null when storage is unavailable", () => {
    expect(readNotificationsEnabled(null)).toBeNull();
  });
});

describe("writeNotificationsEnabled", () => {
  it("stores 1 when enabled", () => {
    const storage = memoryStorage();
    writeNotificationsEnabled(storage, true);

    expect(storage.getItem(NOTIFICATIONS_STORAGE_KEY)).toBe("1");
  });

  it("removes the key when disabled", () => {
    const storage = memoryStorage();
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, "1");
    writeNotificationsEnabled(storage, false);

    expect(storage.getItem(NOTIFICATIONS_STORAGE_KEY)).toBeNull();
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => writeNotificationsEnabled(null, true)).not.toThrow();
  });
});

describe("initialNotificationsEnabled", () => {
  it("prefers the stored preference over the browser permission", () => {
    const storage = memoryStorage();
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, "0");

    expect(initialNotificationsEnabled(storage)).toBe(false);
  });

  it("falls back to the browser permission when nothing is stored", () => {
    expect(initialNotificationsEnabled(memoryStorage())).toBe(false);
  });
});

describe("canNotify", () => {
  it("requires the app preference and a hidden tab", () => {
    expect(canNotify(true, true)).toBe(false);
    expect(canNotify(false, true)).toBe(false);
    expect(canNotify(true, false)).toBe(false);
  });
});

describe("readSoundEnabled", () => {
  it("returns true when stored as 1", () => {
    const storage = memoryStorage();
    storage.setItem(SOUND_STORAGE_KEY, "1");

    expect(readSoundEnabled(storage)).toBe(true);
  });

  it("returns false when nothing is stored", () => {
    expect(readSoundEnabled(memoryStorage())).toBe(false);
  });

  it("returns false when storage is unavailable", () => {
    expect(readSoundEnabled(null)).toBe(false);
  });
});

describe("writeSoundEnabled", () => {
  it("stores 1 when enabled", () => {
    const storage = memoryStorage();
    writeSoundEnabled(storage, true);

    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe("1");
  });

  it("removes the key when disabled", () => {
    const storage = memoryStorage();
    storage.setItem(SOUND_STORAGE_KEY, "1");
    writeSoundEnabled(storage, false);

    expect(storage.getItem(SOUND_STORAGE_KEY)).toBeNull();
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => writeSoundEnabled(null, true)).not.toThrow();
  });
});

describe("notifications nudge", () => {
  const base = {
    clientReady: true,
    authenticated: true,
    changelogSettled: true,
    changelogOpen: false,
    notificationsEnabled: false,
    asked: false,
    permission: "default" as const,
  };

  it("shows once for an authenticated user with a fresh permission", () => {
    expect(shouldShowNotificationsNudge(base)).toBe(true);
  });

  it("waits until the changelog query settles", () => {
    expect(shouldShowNotificationsNudge({ ...base, changelogSettled: false })).toBe(false);
  });

  it("stays hidden when the nudge was already asked", () => {
    const storage = memoryStorage();
    writeNotificationsNudgeAsked(storage, true);

    expect(readNotificationsNudgeAsked(storage)).toBe(true);
    expect(shouldShowNotificationsNudge({ ...base, asked: true })).toBe(false);
  });

  it("waits while the changelog dialog is open", () => {
    expect(shouldShowNotificationsNudge({ ...base, changelogOpen: true })).toBe(false);
  });

  it("stays hidden when notifications are already enabled or permission is decided", () => {
    expect(shouldShowNotificationsNudge({ ...base, notificationsEnabled: true })).toBe(false);
    expect(shouldShowNotificationsNudge({ ...base, permission: "granted" })).toBe(false);
    expect(shouldShowNotificationsNudge({ ...base, permission: "denied" })).toBe(false);
    expect(shouldShowNotificationsNudge({ ...base, permission: "unsupported" })).toBe(false);
  });

  it("stays hidden before the client is ready or before authentication", () => {
    expect(shouldShowNotificationsNudge({ ...base, clientReady: false })).toBe(false);
    expect(shouldShowNotificationsNudge({ ...base, authenticated: false })).toBe(false);
  });

  it("persists the asked choice", () => {
    const storage = memoryStorage();
    writeNotificationsNudgeAsked(storage, true);
    expect(storage.getItem(NOTIFICATIONS_NUDGE_STORAGE_KEY)).toBe("1");

    writeNotificationsNudgeAsked(storage, false);
    expect(storage.getItem(NOTIFICATIONS_NUDGE_STORAGE_KEY)).toBeNull();
  });
});

describe("playMessageSound", () => {
  class FakeAudioContext {
    static instances: FakeAudioContext[] = [];
    currentTime = 0;
    destination = {};
    resumed = false;

    constructor() {
      FakeAudioContext.instances.push(this);
    }

    resume() {
      this.resumed = true;
      return Promise.resolve();
    }

    createOscillator() {
      return {
        type: "",
        frequency: { setValueAtTime: () => undefined },
        connect: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
      };
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses one audio context and resumes it for every sound", () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });

    playMessageSound();
    playMessageSound();

    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0]?.resumed).toBe(true);
  });
});
