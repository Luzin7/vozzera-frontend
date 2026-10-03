import { Eye, EyeOff, Maximize2, Minimize2, MonitorUp } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { featuredShareId, participantConnectionWarningFor } from "@/lib/vozzera/voice";
import type { ScreenShare } from "@/lib/vozzera/use-screen-share";

function FeaturedVideo({
  share,
  networkWarning,
}: Readonly<{
  share: ScreenShare;
  networkWarning: string | null;
}>) {
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

      {networkWarning && (
        <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-amber-500/90 px-2 py-0.5 text-xs text-white">
          {networkWarning}
        </span>
      )}

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

const MemoizedFeaturedVideo = memo(FeaturedVideo);

export const LocalScreenPreview = memo(function LocalScreenPreview({
  share,
}: Readonly<{ share: ScreenShare }>) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hidden) return;

    share.track.attach(video);

    return () => {
      share.track.detach();
    };
  }, [share, hidden]);

  if (hidden) {
    return (
      <div className="absolute bottom-3 right-3 z-10">
        <Button size="sm" variant="secondary" onClick={() => setHidden(false)}>
          <Eye className="h-3.5 w-3.5" />
          Mostrar prévia
        </Button>
      </div>
    );
  }

  return (
    <div className="group absolute bottom-3 right-3 z-10 w-40 overflow-hidden rounded-md border border-border bg-black shadow-lg sm:w-56">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="aspect-video w-full object-contain"
      />
      <Button
        size="icon"
        variant="secondary"
        className="absolute right-1 top-1 h-7 w-7 bg-black/60 text-foreground hover:bg-black/80"
        onClick={() => setHidden(true)}
        aria-label="Ocultar prévia"
      >
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
});

export const ScreenShareStage = memo(function ScreenShareStage({
  shares,
  remoteQualities,
}: Readonly<{
  shares: ScreenShare[];
  remoteQualities: Record<string, string>;
}>) {
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);

  if (shares.length === 0) return null;

  const featuredId = featuredShareId(selectedShareId, shares);
  const featured = shares.find((share) => share.id === featuredId);
  const networkWarning = featured
    ? participantConnectionWarningFor(remoteQualities[featured.name], featured.name)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {featured && (
        <MemoizedFeaturedVideo key={featured.id} share={featured} networkWarning={networkWarning} />
      )}
      {shares.length > 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-muted/30 px-3 py-2">
          {shares.map((share) => {
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
});
