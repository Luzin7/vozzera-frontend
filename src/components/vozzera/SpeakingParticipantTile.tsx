import { memo } from "react";

import { ParticipantTile } from "@/components/vozzera/ParticipantTile";
import { useIsSpeaking } from "@/lib/vozzera/speaking-store";

type TileProps = Parameters<typeof ParticipantTile>[0];

export const SpeakingParticipantTile = memo(function SpeakingParticipantTile(
  props: Readonly<Omit<TileProps, "isSpeaking">>,
) {
  const isSpeaking = useIsSpeaking(props.identity);
  return <ParticipantTile {...props} isSpeaking={isSpeaking} />;
});
