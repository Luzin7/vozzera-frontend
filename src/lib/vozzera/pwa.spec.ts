import { describe, expect, it } from "vitest";

import {
  APP_BADGE_STORAGE_KEY,
  installOptionFor,
  isAppleMobile,
  launchTargetFor,
  readAppBadgeEnabled,
  writeAppBadgeEnabled,
} from "@/lib/vozzera/pwa";
import type { NotificationStorage } from "@/lib/vozzera/notifications";

function memoryStorage(): NotificationStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

const iPhone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const macSafari =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const windowsChrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

describe("installOptionFor", () => {
  it("says the app is already installed when running standalone", () => {
    expect(installOptionFor({ standalone: true, promptAvailable: true, appleMobile: false })).toBe(
      "installed",
    );
  });

  it("offers the browser install prompt when available", () => {
    expect(installOptionFor({ standalone: false, promptAvailable: true, appleMobile: false })).toBe(
      "prompt",
    );
  });

  it("explains the share menu on iPhone and iPad", () => {
    expect(installOptionFor({ standalone: false, promptAvailable: false, appleMobile: true })).toBe(
      "ios",
    );
  });

  it("admits when the browser cannot install apps", () => {
    expect(
      installOptionFor({ standalone: false, promptAvailable: false, appleMobile: false }),
    ).toBe("unavailable");
  });
});

describe("isAppleMobile", () => {
  it("recognizes iPhone and iPad", () => {
    expect(isAppleMobile(iPhone, 5)).toBe(true);
    expect(isAppleMobile(macSafari, 5)).toBe(true);
  });

  it("ignores desktop browsers", () => {
    expect(isAppleMobile(macSafari, 0)).toBe(false);
    expect(isAppleMobile(windowsChrome, 0)).toBe(false);
  });
});

describe("launchTargetFor", () => {
  const current = "https://vozzera.vercel.app/";

  it("only focuses the open window when the app icon is used", () => {
    expect(launchTargetFor("https://vozzera.vercel.app/", current)).toBe(null);
  });

  it("navigates to links opened from outside", () => {
    expect(launchTargetFor("https://vozzera.vercel.app/reset?token=abc", current)).toBe(
      "https://vozzera.vercel.app/reset?token=abc",
    );
  });

  it("stays put when already on the target", () => {
    const resetUrl = "https://vozzera.vercel.app/reset?token=abc";
    expect(launchTargetFor(resetUrl, resetUrl)).toBe(null);
  });
});

describe("app badge preference", () => {
  it("is on by default", () => {
    expect(readAppBadgeEnabled(memoryStorage())).toBe(true);
    expect(readAppBadgeEnabled(null)).toBe(true);
  });

  it("remembers when the user turns it off and back on", () => {
    const storage = memoryStorage();

    writeAppBadgeEnabled(storage, false);
    expect(storage.getItem(APP_BADGE_STORAGE_KEY)).toBe("0");
    expect(readAppBadgeEnabled(storage)).toBe(false);

    writeAppBadgeEnabled(storage, true);
    expect(readAppBadgeEnabled(storage)).toBe(true);
  });
});
