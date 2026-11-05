import { MicOff, MonitorUp, Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { avatarColorClass, initials } from "@/lib/vozzera/avatar";
import { useIsSpeaking } from "@/lib/vozzera/speaking-store";
import { participantStatusLabelFor } from "@/lib/vozzera/voice";

const ROW_TRIGGER_CLASS =
  "group/volume flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-md py-0.5 pr-1.5 text-left transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:min-h-0";

type Props = {
  name: string;
  volume: number;
  screenShareVolume: number;
  locallyMuted: boolean;
  screenShareLocallyMuted: boolean;
  isMuted: boolean;
  isStreaming: boolean;
  identity: string;
  onSetVolume: (volume: number) => void;
  onSetScreenShareVolume: (volume: number) => void;
  onToggleLocalMute: () => void;
  onToggleLocalScreenShareMute: () => void;
  triggerClassName?: string;
  iconClassName?: string;
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
  identity,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
  triggerClassName = ROW_TRIGGER_CLASS,
  iconClassName = "ml-auto",
  children,
}: Readonly<Props>) {
  const isSpeaking = useIsSpeaking(identity);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Ajustar volume de ${name}`}
          title={`Ajustar volume de ${name}`}
          className={triggerClassName}
        >
          {children}
          <Volume2
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/volume:opacity-100 group-focus-visible/volume:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-60",
              iconClassName,
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" collisionPadding={8} className="w-72 p-0">
        <div className="flex items-center gap-3 p-3.5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold ${avatarColorClass(name)}`}
          >
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
