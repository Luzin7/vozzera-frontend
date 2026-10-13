import { useEffect, useState, useSyncExternalStore } from "react";

import {
  installPromptAvailable,
  promptInstall,
  subscribeToInstallPrompt,
} from "@/lib/vozzera/install-prompt";
import { installOptionFor, isAppleMobile } from "@/lib/vozzera/pwa";
import type { InstallOption } from "@/lib/vozzera/pwa";

const STANDALONE_QUERY = "(display-mode: standalone), (display-mode: window-controls-overlay)";

function runsStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(STANDALONE_QUERY).matches;
}

export function useInstallPrompt(): { installOption: InstallOption; install: () => Promise<void> } {
  const promptAvailable = useSyncExternalStore(
    subscribeToInstallPrompt,
    installPromptAvailable,
    () => false,
  );
  const [standalone, setStandalone] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => {
    setStandalone(runsStandalone());
    setAppleMobile(isAppleMobile(navigator.userAgent, navigator.maxTouchPoints));

    const media = window.matchMedia(STANDALONE_QUERY);
    const markInstalled = () => setStandalone(true);
    const followDisplayMode = () => setStandalone(runsStandalone());

    window.addEventListener("appinstalled", markInstalled);
    media.addEventListener("change", followDisplayMode);

    return () => {
      window.removeEventListener("appinstalled", markInstalled);
      media.removeEventListener("change", followDisplayMode);
    };
  }, []);

  return {
    installOption: installOptionFor({ standalone, promptAvailable, appleMobile }),
    install: promptInstall,
  };
}
