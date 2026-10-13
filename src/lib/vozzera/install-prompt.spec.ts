import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureInstallPrompt,
  installPromptAvailable,
  promptInstall,
  subscribeToInstallPrompt,
} from "@/lib/vozzera/install-prompt";

function installPromptEvent(prompt: () => Promise<void>): Event {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt });
}

describe("install prompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the browser prompt and uses it only once", async () => {
    vi.stubGlobal("window", new EventTarget());
    const prompt = vi.fn(async () => undefined);
    const listener = vi.fn();
    captureInstallPrompt();
    subscribeToInstallPrompt(listener);

    const event = installPromptEvent(prompt);
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(installPromptAvailable()).toBe(true);

    await promptInstall();
    await promptInstall();

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(installPromptAvailable()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
