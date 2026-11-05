import { useEffect, useState } from "react";

import { formatCallDuration } from "@/lib/vozzera/call-duration";

const TICK_MS = 1000;

export function CallDuration({ connectedAt }: Readonly<{ connectedAt: number | null }>) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (connectedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [connectedAt]);

  if (connectedAt === null) return null;

  return (
    <span
      role="timer"
      aria-label="Duração da chamada"
      className="absolute left-4 font-mono text-xs tabular-nums text-muted-foreground"
    >
      {formatCallDuration(now - connectedAt)}
    </span>
  );
}
