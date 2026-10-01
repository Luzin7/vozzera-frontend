import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScreenShareStage, LocalScreenPreview } from "@/components/vozzera/ScreenShareStage";
import { initials } from "@/lib/vozzera/avatar";
import type { ScreenShareHealth } from "@/lib/vozzera/voice";
import { isParticipantLocallyInaudible, screenShareHealthMessageFor } from "@/lib/vozzera/voice";
import { useCanShareScreen } from "@/lib/vozzera/use-can-share-screen";
import type { ConnectionState, ScreenShare, VoiceStatus } from "@/lib/vozzera/useVoice";

type Props = {
  roomName: string;
  status: VoiceStatus;
  connectionState: ConnectionState;
  participants: string[];
  username: string | null;
  micEnabled: boolean;
  deafen: boolean;
  volumes: Record<string, number>;
  mutedParticipants: Record<string, boolean>;
  speakingNames: string[];
  screenShareEnabled: boolean;
  screenShareHealth: ScreenShareHealth;
  screenShares: ScreenShare[];
  localPreview: ScreenShare | null;
  remoteQualities: Record<string, string>;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onReduceLocalQuality: (() => void) | undefined;
  onLeave: () => void;
};

function gridLayoutFor(participantCount: number): string {
  if (participantCount > 4) return "max-w-7xl sm:grid-cols-2 xl:grid-cols-3";
  if (participantCount === 3) return "max-w-7xl sm:grid-cols-2 md:grid-cols-3";
  if (participantCount > 1) return "max-w-6xl sm:grid-cols-2";
  return "max-w-4xl";
}

export function VoiceCallView({
  roomName,
  status,
  connectionState,
  participants,
  username,
  micEnabled,
  deafen,
  volumes,
  mutedParticipants,
  speakingNames,
  screenShareEnabled,
  screenShareHealth,
  screenShares,
  localPreview,
  remoteQualities,
  onToggleMic,
  onToggleScreenShare,
  onReduceLocalQuality,
  onLeave,
}: Readonly<Props>) {
  const isConnected = status === "connected";
  const isSolo = participants.length === 1;
  const gridLayout = gridLayoutFor(participants.length);
  const canShare = useCanShareScreen();
  const healthMessage = screenShareHealthMessageFor(screenShareHealth);
  const showHealth =
    screenShareEnabled && healthMessage !== null && onReduceLocalQuality !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="relative flex min-h-0 flex-1 flex-col">
        {screenShares.length > 0 ? (
          <ScreenShareStage shares={screenShares} remoteQualities={remoteQualities} />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {status === "connecting" ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Conectando ao canal {roomName}...
              </div>
            ) : (
              <div
                className={`mx-auto grid min-h-full w-full content-center grid-cols-1 gap-3 ${gridLayout}`}
              >
                {participants.map((name, index) => {
                  const isSpeaking = speakingNames.includes(name);
                  const isMuted =
                    name === username ? !micEnabled : mutedParticipants[name] === true;
                  const isLocallyInaudible = isParticipantLocallyInaudible(
                    name === username,
                    deafen,
                    volumes[name],
                  );
                  const centersLastParticipant = participants.length === 3 && index === 2;

                  return (
                    <article
                      key={name}
                      className={`relative flex aspect-video w-full items-center justify-center rounded-xl border bg-card p-6 transition-colors ${
                        isSolo ? "max-w-4xl" : ""
                      } ${
                        centersLastParticipant
                          ? "sm:col-span-2 sm:mx-auto sm:w-1/2 md:col-span-1 md:w-full"
                          : ""
                      } ${isSpeaking ? "border-primary" : "border-border"}`}
                    >
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted font-mono text-xl font-semibold text-foreground">
                        {initials(name)}
                      </div>

                      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
                        <span className="truncate">{name}</span>
                        {isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                        {isLocallyInaudible && (
                          <VolumeX
                            aria-label={
                              deafen ? "Silenciado pelo mudo total" : "Silenciado para você"
                            }
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {localPreview && <LocalScreenPreview share={localPreview} />}

        {connectionState === "reconnecting" && (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm text-muted-foreground"
          >
            Reconectando…
          </div>
        )}
      </div>

      {showHealth && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          <span>{healthMessage}</span>
          <Button size="sm" variant="secondary" onClick={() => onReduceLocalQuality?.()}>
            Mudar para Economia
          </Button>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border px-4 py-3">
        <Button
          size="icon"
          variant={micEnabled ? "secondary" : "destructive"}
          className="h-11 w-11"
          onClick={onToggleMic}
          disabled={!isConnected}
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          <span className="sr-only">{micEnabled ? "Silenciar" : "Ativar microfone"}</span>
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="icon"
                  variant={screenShareEnabled ? "default" : "secondary"}
                  className="h-11 w-11"
                  onClick={onToggleScreenShare}
                  disabled={!isConnected || !canShare}
                >
                  {screenShareEnabled ? (
                    <MonitorX className="h-4 w-4" />
                  ) : (
                    <MonitorUp className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {screenShareEnabled ? "Parar de compartilhar tela" : "Compartilhar tela"}
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {canShare
                ? screenShareEnabled
                  ? "Parar de compartilhar tela"
                  : "Compartilhar tela"
                : "Compartilhar tela não é suportado neste dispositivo"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button size="icon" variant="destructive" className="h-11 w-11" onClick={onLeave}>
          <PhoneOff className="h-4 w-4" />
          <span className="sr-only">Sair do canal de voz</span>
        </Button>
      </div>
    </div>
  );
}
