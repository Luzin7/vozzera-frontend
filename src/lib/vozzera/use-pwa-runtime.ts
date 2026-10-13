import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { captureInstallPrompt } from "@/lib/vozzera/install-prompt";
import { launchTargetFor } from "@/lib/vozzera/pwa";

type LaunchParams = { targetURL?: string };

type LaunchQueue = {
  setConsumer: (consumer: (params: LaunchParams) => void) => void;
};

const LAUNCH_URL = typeof window === "undefined" ? "" : window.location.href;

captureInstallPrompt();

function launchQueueOf(win: Window): LaunchQueue | null {
  return (win as Window & { launchQueue?: LaunchQueue }).launchQueue ?? null;
}

export function usePwaRuntime(): void {
  const router = useRouter();

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => null);
  }, []);

  useEffect(() => {
    const launchQueue = launchQueueOf(window);
    if (!launchQueue) return;

    launchQueue.setConsumer(({ targetURL }) => {
      if (!targetURL) return;
      const target = launchTargetFor(targetURL, LAUNCH_URL);
      if (target) void router.navigate({ href: target });
    });
  }, [router]);
}
