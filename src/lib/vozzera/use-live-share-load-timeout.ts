import { useEffect, useState } from "react";

import { LIVE_SHARE_FAILURE_NOTICE_MS, LIVE_SHARE_LOAD_TIMEOUT_MS } from "./screen-share-watch";

export function useLiveShareLoadTimeout(
  pending: boolean,
  onTimeout: () => void,
): { failed: boolean; clearFailure: () => void } {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      onTimeout();
      setFailed(true);
    }, LIVE_SHARE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, onTimeout]);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), LIVE_SHARE_FAILURE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  return { failed, clearFailure: () => setFailed(false) };
}
