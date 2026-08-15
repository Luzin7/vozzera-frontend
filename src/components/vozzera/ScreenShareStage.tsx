import { useEffect, useRef } from "react";

import type { ScreenShare } from "@/lib/vozzera/useVoice";

function ScreenShareVideo({ share }: { share: ScreenShare }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    share.track.attach(video);

    return () => {
      share.track.detach();
    };
  }, [share]);

  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-foreground">
        {share.name}
      </span>
    </div>
  );
}

export function ScreenShareStage({ shares }: { shares: ScreenShare[] }) {
  if (shares.length === 0) return null;

  return (
    <div className="flex h-48 shrink-0 gap-2 border-b border-border bg-muted/30 px-4 py-2">
      {shares.map((share) => (
        <ScreenShareVideo key={share.id} share={share} />
      ))}
    </div>
  );
}
