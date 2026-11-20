import { memo } from "react";
import { HeadphoneOff, MicOff, VolumeX } from "lucide-react";

import { ConnectionQualityBadge } from "@/components/vozzera/ConnectionQualityBadge";
import { ParticipantMenu } from "@/components/vozzera/ParticipantMenu";
import { LiveShareTileControls } from "@/components/vozzera/LiveShareControls";
import { CameraTileVideo } from "@/components/vozzera/CameraTileVideo";
import { AWAY_TOOLTIP_TEXT } from "@/lib/vozzera/away";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import { useCameraState } from "@/lib/vozzera/camera-store";

type ParticipantTileProps = {
  identity: string;
  name: string;
  isLocal: boolean;
  isAway: boolean;
  layoutClassName: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isLocallyInaudible: boolean;
  quality: string | undefined;
  liveShareName: string | undefined;
  isWatchPending: boolean;
  volume: number;
  screenShareVolume: number;
  isStreaming: boolean;
  onSetVolume: (identity: string, volume: number) => void;
  onSetScreenShareVolume: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onToggleLocalScreenShareMute: (identity: string) => void;
  onWatchShare: (identity: string) => void;
  onStopWatchingShare: (identity: string) => void;
  onCameraActivate?: (identity: string, trigger: HTMLButtonElement) => void;
};

const TILE_MENU_TRIGGER_CLASS =
  "group/volume absolute inset-0 cursor-pointer rounded-xl transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none";
const VIDEO_TILE_MENU_TRIGGER_CLASS =
  "group/volume absolute right-1 top-1 z-30 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-background/70 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none";

export const ParticipantTile = memo(function ParticipantTile({
  identity,
  name,
  isLocal,
  isAway,
  layoutClassName,
  isSpeaking,
  isMuted,
  isDeafened,
  isLocallyInaudible,
  quality,
  liveShareName,
  isWatchPending,
  volume,
  screenShareVolume,
  isStreaming,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
  onWatchShare,
  onStopWatchingShare,
  onCameraActivate,
}: Readonly<ParticipantTileProps>) {
  const camera = useCameraState(identity);
  const showsCamera = camera.on && camera.track !== null;
  if (isAway) {
    return (
      <article
        title={AWAY_TOOLTIP_TEXT}
        aria-label={`${name}: ausente, não está ouvindo`}
        className={`relative flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-card p-6 opacity-50 transition-opacity motion-reduce:transition-none ${layoutClassName}`}
      >
        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-full font-mono text-xl font-semibold ${avatarColorClass(name)}`}
        >
          {initials(name)}
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 rounded-full bg-background px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground"
          >
            zzz
          </span>
        </div>

        <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
          <span className="truncate">{name}</span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border bg-card p-6 ring-offset-background transition-[box-shadow,border-color] duration-150 motion-reduce:transition-none border-border ${
        showsCamera && isSpeaking ? "ring-2 ring-primary ring-offset-2" : ""
      } ${layoutClassName}`}
    >
      {showsCamera && (
        <CameraTileVideo
          identity={identity}
          name={name}
          camera={camera}
          {...(onCameraActivate ? { onActivate: onCameraActivate } : {})}
        />
      )}
      {!isLocal && (
        <ParticipantMenu
          name={name}
          volume={volume}
          screenShareVolume={screenShareVolume}
          locallyMuted={volume === 0}
          screenShareLocallyMuted={screenShareVolume === 0}
          isMuted={isMuted}
          isStreaming={isStreaming}
          identity={identity}
          onSetVolume={(next) => onSetVolume(identity, next)}
          onSetScreenShareVolume={(next) => onSetScreenShareVolume(identity, next)}
          onToggleLocalMute={() => onToggleLocalMute(identity)}
          onToggleLocalScreenShareMute={() => onToggleLocalScreenShareMute(identity)}
          triggerClassName={showsCamera ? VIDEO_TILE_MENU_TRIGGER_CLASS : TILE_MENU_TRIGGER_CLASS}
          iconClassName={showsCamera ? "h-4 w-4" : "absolute bottom-3 right-3 h-4 w-4"}
        >
          {null}
        </ParticipantMenu>
      )}
      {liveShareName !== undefined && (
        <LiveShareTileControls
          identity={identity}
          name={liveShareName}
          pending={isWatchPending}
          onWatch={onWatchShare}
          onStopWatching={onStopWatchingShare}
        />
      )}
      {!showsCamera && (
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full font-mono text-xl font-semibold ring-offset-card transition-[box-shadow,border-color] duration-150 motion-reduce:transition-none ${avatarColorClass(name)} ${
            isSpeaking ? "ring-2 ring-primary ring-offset-2" : "ring-0 ring-offset-0"
          }`}
        >
          {initials(name)}
        </div>
      )}

      <div className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
        <span className="truncate">{name}</span>
        <ConnectionQualityBadge quality={quality} />
        {isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-destructive" />}
        {isDeafened && (
          <HeadphoneOff
            aria-label={isLocal ? "Você está no mudo total" : `${name} está no mudo total`}
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        )}
        {isLocallyInaudible && (
          <VolumeX
            aria-label="Silenciado para você"
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        )}
      </div>
    </article>
  );
});
