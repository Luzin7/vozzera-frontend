import { describe, expect, it } from "vitest";

import {
  readSeenRelease,
  SEEN_RELEASE_KEY,
  shouldShowChangelog,
  writeSeenRelease,
} from "./changelog";
import type { Changelog, ChangelogStorage } from "./changelog";

function memoryStorage(): ChangelogStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function changelog(version: string, items = 1): Changelog {
  return {
    version,
    items: Array.from({ length: items }, (_, index) => ({
      title: `Novidade ${index}`,
      pr: index,
    })),
  };
}

describe("readSeenRelease", () => {
  it("returns null when nothing is stored", () => {
    expect(readSeenRelease(memoryStorage())).toBeNull();
  });

  it("returns the stored version", () => {
    const storage = memoryStorage();
    storage.setItem(SEEN_RELEASE_KEY, "v1.0.0");

    expect(readSeenRelease(storage)).toBe("v1.0.0");
  });

  it("returns null when storage is unavailable", () => {
    expect(readSeenRelease(null)).toBeNull();
  });
});

describe("writeSeenRelease", () => {
  it("stores the version", () => {
    const storage = memoryStorage();
    writeSeenRelease(storage, "v1.1.0");

    expect(storage.getItem(SEEN_RELEASE_KEY)).toBe("v1.1.0");
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => writeSeenRelease(null, "v1.1.0")).not.toThrow();
  });
});

describe("shouldShowChangelog", () => {
  it("hides when there is no changelog", () => {
    expect(shouldShowChangelog(null, null)).toBe(false);
  });

  it("hides when there are no highlights", () => {
    expect(shouldShowChangelog(changelog("v1.0.0", 0), null)).toBe(false);
  });

  it("shows for a release the user has not seen", () => {
    expect(shouldShowChangelog(changelog("v1.0.0"), null)).toBe(true);
  });

  it("hides for a release the user already saw", () => {
    expect(shouldShowChangelog(changelog("v1.0.0"), "v1.0.0")).toBe(false);
  });

  it("shows again for the next release", () => {
    expect(shouldShowChangelog(changelog("v1.1.0"), "v1.0.0")).toBe(true);
  });
});
