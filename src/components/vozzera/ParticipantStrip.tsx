import { memo } from "react";

import { CompactParticipant } from "@/components/vozzera/CompactParticipant";
import type { CompactParticipantProps } from "@/components/vozzera/CompactParticipant";
import type { CallTile } from "@/lib/vozzera/away";
import { orderStripTiles } from "@/lib/vozzera/participant-strip";
import { isParticipantLocallyInaudible, isParticipantMuted } from "@/lib/vozzera/voice";

type StripHandlers = Pick<
  CompactParticipantProps,
  "onSetVolume" | "onSetScreenShareVolume" | "onToggleLocalMute" | "onToggleLocalScreenShareMute"
>;

type Props = StripHandlers & {
  tiles: CallTile[];
  micEnabled: boolean;
  deafen: boolean;
  volumes: Record<string, number>;
  screenShareVolumes: Record<string, number>;
  mutedParticipants: Record<string, boolean>;
  deafenedParticipants: Record<string, boolean>;
  qualities: Record<string, string>;
  streamingIdentities: ReadonlySet<string>;
};

export const ParticipantStrip = memo(function ParticipantStrip({
  tiles,
  micEnabled,
  deafen,
  volumes,
  screenShareVolumes,
  mutedParticipants,
  deafenedParticipants,
  qualities,
  streamingIdentities,
  ...handlers
}: Readonly<Props>) {
  return (
    <ul
      aria-label="Participantes"
      className="flex shrink-0 flex-row gap-2 overflow-x-auto overflow-y-hidden border-t border-border bg-muted/30 p-2 lg:w-52 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-l lg:border-t-0"
    >
      {orderStripTiles(tiles).map(({ identity, name, isLocal, isAway }) => (
        <CompactParticipant
          key={identity}
          identity={identity}
          name={name}
          isLocal={isLocal}
          isAway={isAway}
          isMuted={isParticipantMuted({ identity, isLocal, micEnabled, mutedParticipants })}
          isDeafened={(isLocal && deafen) || deafenedParticipants[identity] === true}
          isLocallyInaudible={isParticipantLocallyInaudible(isLocal, volumes[identity])}
          quality={qualities[identity]}
          volume={volumes[identity] ?? 1}
          screenShareVolume={screenShareVolumes[identity] ?? 1}
          isStreaming={streamingIdentities.has(identity)}
          {...handlers}
        />
      ))}
    </ul>
  );
});
