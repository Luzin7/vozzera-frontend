import { useCallback, useEffect, useState } from "react";

import { readAppBadgeEnabled, writeAppBadgeEnabled } from "@/lib/vozzera/pwa";

function preferenceStorage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function useAppBadge(unreadCount: number): {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
} {
  const [enabled, setEnabledState] = useState(() => readAppBadgeEnabled(preferenceStorage()));

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeAppBadgeEnabled(preferenceStorage(), next);
  }, []);

  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;

    if (!enabled || unreadCount === 0) {
      void navigator.clearAppBadge().catch(() => null);
      return;
    }

    void navigator.setAppBadge(unreadCount).catch(() => null);
  }, [enabled, unreadCount]);

  return { enabled, setEnabled };
}
