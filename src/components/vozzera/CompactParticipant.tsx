import { memo } from "react";
import { HeadphoneOff, MicOff, VolumeX } from "lucide-react";

import { ConnectionQualityBadge } from "@/components/vozzera/ConnectionQualityBadge";
import { ParticipantMenu } from "@/components/vozzera/ParticipantMenu";
import { SpeakingRing } from "@/components/vozzera/SpeakingRing";
import { AWAY_TOOLTIP_TEXT } from "@/lib/vozzera/away";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";

export type CompactParticipantProps = {
  identity: string;
  name: string;
  isLocal: boolean;
  isAway: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isLocallyInaudible: boolean;
  quality: string | undefined;
  volume: number;
  screenShareVolume: number;
  isStreaming: boolean;
  onSetVolume: (identity: string, volume: number) => void;
  onSetScreenShareVolume: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onToggleLocalScreenShareMute: (identity: string) => void;
};

const ITEM_CLASS =
  "relative flex h-12 w-36 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2 lg:w-full";
const TRIGGER_CLASS =
  "group/volume absolute inset-0 cursor-pointer rounded-lg transition-colors hover:bg-foreground/5 focus-visible:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none";
const AVATAR_BASE_CLASS =
  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold ring-offset-card transition-[box-shadow] duration-150 motion-reduce:transition-none";

function CompactAvatar({
  identity,
  name,
  isAway,
}: Readonly<{ identity: string; name: string; isAway: boolean }>) {
  if (isAway) {
    return (
      <span className={`${AVATAR_BASE_CLASS} ${avatarColorClass(name)}`}>
        {initials(name)}
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -top-1.5 rounded-full bg-background px-1 font-mono text-[10px] font-semibold leading-4 text-muted-foreground"
        >
          zzz
        </span>
      </span>
    );
  }

  return (
    <SpeakingRing
      identity={identity}
      baseClassName={`${AVATAR_BASE_CLASS} ${avatarColorClass(name)}`}
      speakingClassName="ring-2 ring-primary ring-offset-2"
      idleClassName="ring-0 ring-offset-0"
    >
      {initials(name)}
    </SpeakingRing>
  );
}

export const CompactParticipant = memo(function CompactParticipant({
  identity,
  name,
  isLocal,
  isAway,
  isMuted,
  isDeafened,
  isLocallyInaudible,
  quality,
  volume,
  screenShareVolume,
  isStreaming,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
}: Readonly<CompactParticipantProps>) {
  const hasVolumeMenu = !isLocal && !isAway;

  return (
    <li
      title={isAway ? AWAY_TOOLTIP_TEXT : undefined}
      aria-label={isAway ? `${name}: ausente, não está ouvindo` : undefined}
      className={`${ITEM_CLASS} ${isAway ? "opacity-50" : ""}`}
    >
      {hasVolumeMenu && (
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
          triggerClassName={TRIGGER_CLASS}
          iconClassName="absolute right-1.5 top-1.5 h-3 w-3"
        />
      )}
      <CompactAvatar identity={identity} name={name} isAway={isAway} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
      {!isAway && (
        <span className="pointer-events-none relative z-10 flex shrink-0 items-center gap-1">
          <span className="pointer-events-auto flex">
            <ConnectionQualityBadge quality={quality} />
          </span>
          {isMuted && <MicOff aria-label="Mic mutado" className="h-3.5 w-3.5 text-destructive" />}
          {isDeafened && (
            <HeadphoneOff
              aria-label={isLocal ? "Você está no mudo total" : `${name} está no mudo total`}
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          )}
          {isLocallyInaudible && (
            <VolumeX
              aria-label="Silenciado para você"
              className="h-3.5 w-3.5 text-muted-foreground"
            />
          )}
        </span>
      )}
    </li>
  );
});
