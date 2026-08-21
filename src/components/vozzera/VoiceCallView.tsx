import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScreenShareStage } from "@/components/vozzera/ScreenShareStage";
import { initials } from "@/lib/vozzera/avatar";
import type { ScreenShare, VoiceStatus } from "@/lib/vozzera/useVoice";

type Props = {
  roomName: string;
  status: VoiceStatus;
  participants: string[];
  username: string | null;
  micEnabled: boolean;
  mutedParticipants: Record<string, boolean>;
  speakingNames: string[];
  screenShareEnabled: boolean;
  screenShares: ScreenShare[];
  localPreview: ScreenShare | null;
  isTabHidden: boolean;
  onToggleMic: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
};

function gridLayoutFor(participantCount: number): string {
  if (participantCount > 4) return "max-w-7xl sm:grid-cols-2 xl:grid-cols-3";
  if (participantCount > 1) return "max-w-6xl sm:grid-cols-2";
  return "max-w-4xl";
}

export function VoiceCallView({
  roomName,
  status,
  participants,
  username,
  micEnabled,
  mutedParticipants,
  speakingNames,
  screenShareEnabled,
  screenShares,
  localPreview,
  isTabHidden,
  onToggleMic,
  onToggleScreenShare,
  onLeave,
}: Readonly<Props>) {
  const isConnected = status === "connected";
  const isSolo = participants.length === 1;
  const gridLayout = gridLayoutFor(participants.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {screenShares.length > 0 || localPreview ? (
        <ScreenShareStage
          shares={screenShares}
          localPreview={localPreview}
          isTabHidden={isTabHidden}
        />
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
                const isMuted = name === username ? !micEnabled : mutedParticipants[name] === true;
                const centersLastParticipant = participants.length === 3 && index === 2;

                return (
                  <article
                    key={name}
                    className={`relative flex aspect-video w-full items-center justify-center rounded-xl border bg-card p-6 transition-colors ${
                      isSolo ? "max-w-4xl" : ""
                    } ${centersLastParticipant ? "sm:col-span-2 sm:mx-auto sm:w-1/2" : ""} ${
                      isSpeaking ? "border-primary" : "border-border"
                    }`}
                  >
                    <div
                      className={`flex h-20 w-20 items-center justify-center rounded-full bg-muted font-mono text-xl font-semibold text-foreground ring-offset-4 ring-offset-card ${
                        isSpeaking ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {initials(name)}
                    </div>

                    <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md bg-background/80 px-2 py-1 text-sm text-foreground">
                      <span className="truncate">{name}</span>
                      {isMuted && <MicOff className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
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

        <Button
          size="icon"
          variant={screenShareEnabled ? "default" : "secondary"}
          className="h-11 w-11"
          onClick={onToggleScreenShare}
          disabled={!isConnected}
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

        <Button size="icon" variant="destructive" className="h-11 w-11" onClick={onLeave}>
          <PhoneOff className="h-4 w-4" />
          <span className="sr-only">Sair do canal de voz</span>
        </Button>
      </div>
    </div>
  );
}
