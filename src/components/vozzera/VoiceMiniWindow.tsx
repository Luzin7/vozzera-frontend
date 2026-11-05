import { HeadphoneOff, Headphones, Mic, MicOff, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { initials } from "@/lib/vozzera/avatar";
import { AWAY_TOOLTIP_TEXT } from "@/lib/vozzera/away";
import type { CallTile } from "@/lib/vozzera/away";
import { isParticipantMuted } from "@/lib/vozzera/voice";

type Props = {
  roomName: string;
  tiles: CallTile[];
  micEnabled: boolean;
  deafen: boolean;
  mutedParticipants: Record<string, boolean>;
  speakingIdentities: string[];
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onLeave: () => void;
};

export function VoiceMiniWindow({
  roomName,
  tiles,
  micEnabled,
  deafen,
  mutedParticipants,
  speakingIdentities,
  onToggleMic,
  onToggleDeafen,
  onLeave,
}: Readonly<Props>) {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="shrink-0 truncate border-b border-border px-3 py-2 text-sm font-medium">
        {roomName}
      </header>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {tiles.map(({ identity, name, isLocal, isAway }) => {
          const isMuted = isParticipantMuted({
            identity,
            isLocal,
            micEnabled,
            mutedParticipants,
          });

          return (
            <li
              key={identity}
              title={isAway ? AWAY_TOOLTIP_TEXT : undefined}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                isAway ? "opacity-50" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs ring-2 ${
                  speakingIdentities.includes(identity) ? "ring-primary" : "ring-transparent"
                }`}
              >
                {initials(name)}
              </span>
              <span className="truncate">{name}</span>
              {isAway && (
                <>
                  <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
                    zzz
                  </span>
                  <span className="sr-only">{AWAY_TOOLTIP_TEXT}</span>
                </>
              )}
              {!isAway && isMuted && (
                <MicOff className="ml-auto h-3.5 w-3.5 shrink-0 text-destructive" />
              )}
            </li>
          );
        })}
      </ul>

      <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-border p-2">
        <Button
          size="icon"
          variant={micEnabled ? "secondary" : "destructive"}
          className="h-10 w-10"
          onClick={onToggleMic}
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span className="sr-only">{micEnabled ? "Silenciar" : "Ativar microfone"}</span>
        </Button>
        <Button
          size="icon"
          variant={deafen ? "destructive" : "secondary"}
          className="h-10 w-10"
          onClick={onToggleDeafen}
        >
          {deafen ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          <span className="sr-only">{deafen ? "Ativar som" : "Mudo total"}</span>
        </Button>
        <Button size="icon" variant="destructive" className="h-10 w-10" onClick={onLeave}>
          <PhoneOff className="h-4 w-4" />
          <span className="sr-only">Sair do canal de voz</span>
        </Button>
      </footer>
    </div>
  );
}
