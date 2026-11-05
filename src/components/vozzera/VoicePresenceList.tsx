import { AWAY_TOOLTIP_TEXT, sidebarEntriesFor } from "@/lib/vozzera/away";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import type { AwayEntry, VoiceParticipant } from "@/lib/vozzera/types";

type Props = {
  participants: VoiceParticipant[];
  away: AwayEntry[];
};

export function VoicePresenceList({ participants, away }: Readonly<Props>) {
  const entries = sidebarEntriesFor(participants, away);
  if (entries.length === 0) return null;

  return (
    <ul aria-label="Participantes na chamada" className="mb-1 ml-8 mt-1.5 space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.userId}
          title={entry.isAway ? AWAY_TOOLTIP_TEXT : undefined}
          className={`flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground ${
            entry.isAway ? "opacity-50" : ""
          }`}
        >
          <span className="relative shrink-0">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] font-semibold ${avatarColorClass(entry.username)}`}
            >
              {initials(entry.username)}
            </span>
            {entry.isAway ? (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 font-mono text-[9px] font-semibold text-muted-foreground"
              >
                zzz
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-sidebar bg-primary"
              />
            )}
          </span>
          <span className="truncate">{entry.username}</span>
          {entry.isAway && <span className="sr-only">{AWAY_TOOLTIP_TEXT}</span>}
        </li>
      ))}
    </ul>
  );
}
