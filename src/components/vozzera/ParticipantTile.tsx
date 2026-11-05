import { memo } from "react";
import { HeadphoneOff, MicOff, VolumeX } from "lucide-react";

import { ConnectionQualityBadge } from "@/components/vozzera/ConnectionQualityBadge";
import { LiveShareTileControls } from "@/components/vozzera/LiveShareControls";
import { AWAY_TOOLTIP_TEXT } from "@/lib/vozzera/away";
import { initials } from "@/lib/vozzera/avatar";

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
  onWatchShare: (identity: string) => void;
  onStopWatchingShare: (identity: string) => void;
};

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
  onWatchShare,
  onStopWatchingShare,
}: Readonly<ParticipantTileProps>) {
  if (isAway) {
    return (
      <article
        title={AWAY_TOOLTIP_TEXT}
        aria-label={`${name}: ausente, não está ouvindo`}
        className={`relative flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-card p-6 opacity-50 transition-opacity motion-reduce:transition-none ${layoutClassName}`}
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-muted font-mono text-xl font-semibold text-foreground">
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
      className={`relative flex aspect-video w-full items-center justify-center rounded-xl border bg-card p-6 transition-colors motion-reduce:transition-none ${layoutClassName} ${
        isSpeaking ? "border-primary" : "border-border"
      }`}
    >
      {liveShareName !== undefined && (
        <LiveShareTileControls
          identity={identity}
          name={liveShareName}
          pending={isWatchPending}
          onWatch={onWatchShare}
          onStopWatching={onStopWatchingShare}
        />
      )}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted font-mono text-xl font-semibold text-foreground">
        {initials(name)}
      </div>

      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
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
