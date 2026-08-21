import { describe, expect, it } from "vitest";

import {
  canNotify,
  initialNotificationsEnabled,
  NOTIFICATIONS_STORAGE_KEY,
  readNotificationsEnabled,
  readSoundEnabled,
  SOUND_STORAGE_KEY,
  writeNotificationsEnabled,
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
