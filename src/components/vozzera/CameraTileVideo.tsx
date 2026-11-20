import { memo, useEffect, useRef } from "react";

import { isMirroredPreview } from "@/lib/vozzera/camera";
import type { CameraState } from "@/lib/vozzera/camera-store";
import { cn } from "@/lib/utils";

type Props = {
  identity: string;
  name: string;
  camera: CameraState;
  className?: string;
  onActivate?: (identity: string, trigger: HTMLButtonElement) => void;
};

export const CameraTileVideo = memo(function CameraTileVideo({
  identity,
  name,
  camera,
  className,
  onActivate,
}: Readonly<Props>) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !camera.track) return;
    camera.track.attach(video);
    return () => {
      camera.track?.detach(video);
    };
  }, [camera.track]);

  if (!camera.on || !camera.track) return null;

  const mirrored = isMirroredPreview(camera.isLocal ? "local" : "remote", camera.facingMode);
  const video = (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={camera.isLocal}
      className={cn("h-full w-full object-cover", mirrored && "-scale-x-100")}
    />
  );

  if (!onActivate) {
    return (
      <div className={cn("absolute inset-0 z-10 overflow-hidden rounded-[inherit]", className)}>
        {video}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "absolute inset-0 z-10 overflow-hidden rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      onClick={(event) => onActivate(identity, event.currentTarget)}
      aria-label={`Ampliar vídeo de ${name}`}
    >
      {video}
    </button>
  );
});
