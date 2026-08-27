import { initials } from "@/lib/vozzera/avatar";
import type { VoiceParticipant } from "@/lib/vozzera/types";

type Props = {
  participants: VoiceParticipant[];
  currentUserId: string | null;
};

export function VoicePresenceList({ participants, currentUserId }: Readonly<Props>) {
  if (participants.length === 0) return null;

  return (
    <ul aria-label="Participantes na chamada" className="mb-1 ml-8 mt-1.5 space-y-2">
      {participants.map((participant) => (
        <li
          key={participant.user_id}
          className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"
        >
          <span className="relative shrink-0">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-foreground">
              {initials(participant.username)}
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-sidebar bg-primary"
            />
          </span>
          <span className="truncate">{participant.username}</span>
          {participant.user_id === currentUserId && <span className="shrink-0">(você)</span>}
        </li>
      ))}
    </ul>
  );
}
