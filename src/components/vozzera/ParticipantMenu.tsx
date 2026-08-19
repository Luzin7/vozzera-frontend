import { MicOff, MonitorUp, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { initials } from "@/lib/vozzera/avatar";
import { participantStatusLabelFor } from "@/lib/vozzera/voice";

type Props = {
  name: string;
  volume: number;
  locallyMuted: boolean;
  isMuted: boolean;
  isStreaming: boolean;
  isSpeaking: boolean;
  onSetVolume: (volume: number) => void;
  onToggleLocalMute: () => void;
  children: ReactNode;
};

export function ParticipantMenu({
  name,
  volume,
  locallyMuted,
  isMuted,
  isStreaming,
  isSpeaking,
  onSetVolume,
  onToggleLocalMute,
  children,
}: Readonly<Props>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Opções de ${name}`}
          className="flex min-h-11 w-full items-center rounded-md px-1 py-0.5 text-left hover:bg-sidebar-accent/60 md:min-h-0"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-60 p-0">
        <div className="flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-semibold text-foreground">
            {initials(name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
              <span className="truncate">{name}</span>
              {isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-destructive" />}
              {isStreaming && <MonitorUp className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {participantStatusLabelFor(locallyMuted, isSpeaking)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-3.5 py-3">
          <button
            type="button"
            onClick={onToggleLocalMute}
            aria-label={locallyMuted ? `Ouvir ${name}` : `Silenciar ${name} para mim`}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors ${
              locallyMuted
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {locallyMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <Slider
            value={[volume]}
            min={0}
            max={1}
            step={0.05}
            aria-label={`Volume de ${name}`}
            onValueChange={([nextVolume]) => {
              if (nextVolume !== undefined) onSetVolume(nextVolume);
            }}
          />
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
