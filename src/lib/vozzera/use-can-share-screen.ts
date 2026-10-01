import { useEffect, useState } from "react";

import { canShareScreen } from "./voice";

export function useCanShareScreen(): boolean {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(canShareScreen(navigator.mediaDevices));
  }, []);

  return supported;
}
