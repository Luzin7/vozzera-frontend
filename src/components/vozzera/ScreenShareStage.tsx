import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ScreenShare } from "@/lib/vozzera/useVoice";

function ScreenShareVideo({ share }: { share: ScreenShare }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    share.track.attach(video);

    return () => {
      share.track.detach();
    };
  }, [share]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    const container = containerRef.current;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    if (container) void container.requestFullscreen();
  };

  return (
    <div
      ref={containerRef}
      className="group relative min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-black"
    >
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-foreground">
        {share.name}
      </span>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-foreground opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
        aria-label={isFullscreen ? "Sair da tela cheia" : "Ver em tela cheia"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function ScreenShareStage({
  shares,
  localPreview,
}: Readonly<{
  shares: ScreenShare[];
  localPreview: ScreenShare | null;
}>) {
  if (shares.length === 0 && !localPreview) return null;

  return (
    <div className="flex h-48 shrink-0 gap-2 border-b border-border bg-muted/30 px-4 py-2">
      {localPreview && <ScreenShareVideo key="local" share={localPreview} />}
      {shares.map((share) => (
        <ScreenShareVideo key={share.id} share={share} />
      ))}
    </div>
  );
}
