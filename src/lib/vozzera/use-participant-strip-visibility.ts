import { useCallback, useState } from "react";

import { readStripVisible, writeStripVisible } from "@/lib/vozzera/participant-strip";

function storage(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

export function useParticipantStripVisibility(): { visible: boolean; toggle: () => void } {
  const [visible, setVisible] = useState(() => readStripVisible(storage()));

  const toggle = useCallback(() => {
    const next = !visible;
    setVisible(next);
    writeStripVisible(storage(), next);
  }, [visible]);

  return { visible, toggle };
}
