import { Maximize2, Minimize2, MonitorUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  fpsColorFor,
  fpsLabelFor,
  fpsSeverityFor,
  featuredShareId,
  remoteFpsLabelFor,
} from "@/lib/vozzera/voice";
import type { FpsSeverity, ScreenShare } from "@/lib/vozzera/useVoice";

const FPS_MONITOR_INTERVAL_MS = 2_000;
const SUGGESTION_THRESHOLD_MS = 6_000;

type FpsInfo = {
  fps: number;
  label: string | null;
  severity: FpsSeverity;
};

function useFpsMonitor(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  targetFps: number,
  isLocal: boolean,
): FpsInfo {
  const [fps, setFps] = useState(targetFps);
  const timestampsRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onFrame = (now: number) => {
      timestampsRef.current.push(now);
      if (timestampsRef.current.length > 60) timestampsRef.current.shift();
      rafRef.current = video.requestVideoFrameCallback(onFrame);
    };

    rafRef.current = video.requestVideoFrameCallback(onFrame);

    intervalRef.current = setInterval(() => {
      const timestamps = timestampsRef.current;
      if (timestamps.length < 2) return;
      const last = timestamps[timestamps.length - 1]!;
      const first = timestamps[0]!;
      const windowMs = last - first;
      const measured = Math.round((timestamps.length / windowMs) * 1000);
      const clamped = Math.min(measured, targetFps * 2);
      setFps(clamped);
    }, FPS_MONITOR_INTERVAL_MS);

    return () => {
      if (rafRef.current) video.cancelVideoFrameCallback(rafRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [videoRef, targetFps]);

  const label = isLocal ? fpsLabelFor(fps, targetFps) : remoteFpsLabelFor(fps);
  const severity = fpsSeverityFor(fps, targetFps);

  return { fps, label, severity };
}

function useSuggestion(
  severity: FpsSeverity,
  onReduce: (() => void) | undefined,
): { show: boolean; dismiss: () => void } {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (severity !== "critical" || dismissedRef.current || !onReduce) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShow(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      setShow(true);
    }, SUGGESTION_THRESHOLD_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [severity, onReduce]);

  const dismiss = () => {
    dismissedRef.current = true;
    setShow(false);
  };

  return { show, dismiss };
}

function FeaturedVideo({
  share,
  isLocal,
  targetFps,
  onReduceQuality,
}: {
  share: ScreenShare;
  isLocal: boolean;
  targetFps: number;
  onReduceQuality: (() => void) | undefined;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { fps, label, severity } = useFpsMonitor(videoRef, targetFps, isLocal);
  const { show: showSuggestion, dismiss: dismissSuggestion } = useSuggestion(
    severity,
    onReduceQuality,
  );

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

      {label && (
        <span
          className={`absolute bottom-2 right-2 rounded ${fpsColorFor(severity)} px-2 py-0.5 text-xs transition-opacity`}
        >
          {label}
        </span>
      )}

      {isLocal && showSuggestion && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-lg bg-background/95 px-4 py-3 shadow-lg">
          <p className="text-xs text-muted-foreground">
            Sua transmissão está com baixo desempenho ({fps} fps)
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                dismissSuggestion();
                onReduceQuality?.();
              }}
            >
              Reduzir para {targetFps >= 60 ? "30" : "15"} FPS
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissSuggestion}>
              Ignorar
            </Button>
          </div>
        </div>
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

export function ScreenShareStage({
  shares,
  localPreview,
  onReduceLocalQuality,
}: Readonly<{
  shares: ScreenShare[];
  localPreview: ScreenShare | null;
  onReduceLocalQuality: (() => void) | undefined;
}>) {
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const allShares = localPreview ? [...shares, localPreview] : shares;

  if (allShares.length === 0) return null;

  const featuredId = featuredShareId(selectedShareId, allShares);
  const featured = allShares.find((share) => share.id === featuredId);
  const isFeaturedLocal = featured?.id === "local";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {featured && (
        <FeaturedVideo
          share={featured}
          isLocal={isFeaturedLocal}
          targetFps={60}
          onReduceQuality={isFeaturedLocal ? onReduceLocalQuality : undefined}
        />
      )}
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
