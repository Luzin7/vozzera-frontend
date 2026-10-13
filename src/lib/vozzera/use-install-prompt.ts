import { useCallback, useEffect, useState } from "react";

import { installOptionFor, isAppleMobile } from "@/lib/vozzera/pwa";
import type { InstallOption } from "@/lib/vozzera/pwa";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

const STANDALONE_QUERY = "(display-mode: standalone), (display-mode: window-controls-overlay)";

function runsStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(STANDALONE_QUERY).matches;
}

export function useInstallPrompt(): { installOption: InstallOption; install: () => Promise<void> } {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => {
    setStandalone(runsStandalone());
    setAppleMobile(isAppleMobile(navigator.userAgent, navigator.maxTouchPoints));

    const media = window.matchMedia(STANDALONE_QUERY);
    const keepPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const markInstalled = () => {
      setPromptEvent(null);
      setStandalone(true);
    };
    const followDisplayMode = () => setStandalone(runsStandalone());

    window.addEventListener("beforeinstallprompt", keepPrompt);
    window.addEventListener("appinstalled", markInstalled);
    media.addEventListener("change", followDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", keepPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      media.removeEventListener("change", followDisplayMode);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    setPromptEvent(null);
  }, [promptEvent]);

  return {
    installOption: installOptionFor({
      standalone,
      promptAvailable: promptEvent !== null,
      appleMobile,
    }),
    install,
  };
}
