import { Maximize2, Minimize2, MonitorUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { featuredShareId } from "@/lib/vozzera/voice";
import type { ScreenShare } from "@/lib/vozzera/useVoice";

function FeaturedVideo({ share }: { share: ScreenShare }) {
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
      className="group relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
    >
      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-foreground">
        {share.name}
      </span>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-md bg-black/60 text-foreground opacity-100 transition-opacity hover:bg-black/80 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const allShares = localPreview ? [...shares, localPreview] : shares;

  if (allShares.length === 0) return null;

  const featuredId = featuredShareId(selectedShareId, allShares);
  const featured = allShares.find((share) => share.id === featuredId);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {featured && <FeaturedVideo share={featured} />}
      {allShares.length > 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/30 px-3 py-2">
          {allShares.map((share) => {
            const isActive = share.id === featuredId;
            return (
              <Button
                key={share.id}
                size="sm"
                variant={isActive ? "default" : "secondary"}
                onClick={() => setSelectedShareId(share.id)}
                aria-pressed={isActive}
                className="shrink-0"
              >
                <MonitorUp className="h-3.5 w-3.5" />
                {share.name}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
