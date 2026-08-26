import { MicOff, MonitorUp, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { initials } from "@/lib/vozzera/avatar";
import { participantStatusLabelFor } from "@/lib/vozzera/voice";

type Props = {
  name: string;
  volume: number;
  screenShareVolume: number;
  locallyMuted: boolean;
  screenShareLocallyMuted: boolean;
  isMuted: boolean;
  isStreaming: boolean;
  isSpeaking: boolean;
  onSetVolume: (volume: number) => void;
  onSetScreenShareVolume: (volume: number) => void;
  onToggleLocalMute: () => void;
  onToggleLocalScreenShareMute: () => void;
  children: ReactNode;
};

function VolumeControl({
  label,
  volume,
  muted,
  onSetVolume,
  onToggleMute,
  icon,
}: Readonly<{
  label: string;
  volume: number;
  muted: boolean;
  onSetVolume: (volume: number) => void;
  onToggleMute: () => void;
  icon: ReactNode;
}>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {Math.round(volume * 100)}%
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? `Ativar ${label.toLowerCase()}` : `Silenciar ${label.toLowerCase()}`}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
            muted
              ? "text-destructive hover:bg-destructive/10"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : icon}
        </button>
        <Slider
          value={[volume]}
          min={0}
          max={2}
          step={0.05}
          aria-label={label}
          onValueChange={([nextVolume]) => {
            if (nextVolume !== undefined) onSetVolume(nextVolume);
          }}
        />
      </div>
    </div>
  );
}

export function ParticipantMenu({
  name,
  volume,
  screenShareVolume,
  locallyMuted,
  screenShareLocallyMuted,
  isMuted,
  isStreaming,
  isSpeaking,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
  children,
}: Readonly<Props>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Opções de ${name}`}
          className="flex min-h-11 w-full items-center rounded-md py-0.5 text-left hover:bg-sidebar-accent/60 md:min-h-0"
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-72 p-0">
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

        <div className="space-y-3 border-t border-border px-3.5 py-3">
          <VolumeControl
            label="Voz"
            volume={volume}
            muted={locallyMuted}
            onSetVolume={onSetVolume}
            onToggleMute={onToggleLocalMute}
            icon={<Volume2 className="h-4 w-4" />}
          />
          {isStreaming && (
            <VolumeControl
              label="Transmissão"
              volume={screenShareVolume}
              muted={screenShareLocallyMuted}
              onSetVolume={onSetScreenShareVolume}
              onToggleMute={onToggleLocalScreenShareMute}
              icon={<MonitorUp className="h-4 w-4" />}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
