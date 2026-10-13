import { useEffect } from "react";

import { launchTargetFor } from "@/lib/vozzera/pwa";

type LaunchParams = { targetURL?: string };

type LaunchQueue = {
  setConsumer: (consumer: (params: LaunchParams) => void) => void;
};

function launchQueueOf(win: Window): LaunchQueue | null {
  return (win as Window & { launchQueue?: LaunchQueue }).launchQueue ?? null;
}

export function usePwaRuntime(): void {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);

  useEffect(() => {
    const launchQueue = launchQueueOf(window);
    if (!launchQueue) return;

    launchQueue.setConsumer(({ targetURL }) => {
      if (!targetURL) return;
      const target = launchTargetFor(targetURL, window.location.href);
      if (target) window.location.assign(target);
    });
  }, []);
}
