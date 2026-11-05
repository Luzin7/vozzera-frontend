import { useMemo, useState } from "react";
import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  PictureInPicture2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CallDuration } from "@/components/vozzera/CallDuration";
import { ParticipantStrip } from "@/components/vozzera/ParticipantStrip";
import { SpeakingParticipantTile } from "@/components/vozzera/SpeakingParticipantTile";
import { ScreenShareStage, LocalScreenPreview } from "@/components/vozzera/ScreenShareStage";
import type { LiveShare, WatchIntents } from "@/lib/vozzera/screen-share-watch";
import { exitNoticeTextFor, OWN_AWAY_TEXT } from "@/lib/vozzera/away";
import type { CallTile, ExitNoticeReason } from "@/lib/vozzera/away";
import type { AwayReason } from "@/lib/vozzera/away-intent";
import type { ScreenShareHealth } from "@/lib/vozzera/voice";
import {
  featuredShareId,
  isParticipantLocallyInaudible,
  isParticipantMuted,
  screenShareHealthMessageFor,
} from "@/lib/vozzera/voice";
import { shouldRenderStrip } from "@/lib/vozzera/participant-strip";
import { useParticipantStripVisibility } from "@/lib/vozzera/use-participant-strip-visibility";
import { useCanShareScreen } from "@/lib/vozzera/use-can-share-screen";
import { labelWithShortcut } from "@/lib/vozzera/voice-shortcuts";
import type { ConnectionState, ScreenShare, VoiceStatus } from "@/lib/vozzera/useVoice";

type Props = {
  roomName: string;
  status: VoiceStatus;
  connectionState: ConnectionState;
  tiles: CallTile[];
  awayReason: AwayReason | null;
  exitNoticeReason: ExitNoticeReason | null;
  micEnabled: boolean;
  deafen: boolean;
  volumes: Record<string, number>;
  screenShareVolumes: Record<string, number>;
  mutedParticipants: Record<string, boolean>;
  deafenedParticipants: Record<string, boolean>;
  screenShareEnabled: boolean;
  screenShareHealth: ScreenShareHealth;
  screenShares: ScreenShare[];
  liveShares: LiveShare[];
  watchingIdentities: WatchIntents;
  localPreview: ScreenShare | null;
  qualities: Record<string, string>;
  connectedAt: number | null;
  miniWindowSupported: boolean;
  miniWindowOpen: boolean;
  onToggleMic: () => void;
  onSetVolume: (identity: string, volume: number) => void;
  onSetScreenShareVolume: (identity: string, volume: number) => void;
  onToggleLocalMute: (identity: string) => void;
  onToggleLocalScreenShareMute: (identity: string) => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onWatchShare: (identity: string) => void;
  onStopWatchingShare: (identity: string) => void;
  onReduceLocalQuality: (() => void) | undefined;
  onToggleMiniWindow: () => void;
  onLeave: () => void;
  onReturn: () => void;
};

function tileLayoutFor(isSolo: boolean, centersLastParticipant: boolean): string {
  const width = isSolo ? "max-w-4xl" : "";
  const centering = centersLastParticipant
    ? "sm:col-span-2 sm:mx-auto sm:w-1/2 md:col-span-1 md:w-full"
    : "";
  return `${width} ${centering}`;
}

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
  tiles,
  awayReason,
  exitNoticeReason,
  micEnabled,
  deafen,
  volumes,
  screenShareVolumes,
  mutedParticipants,
  deafenedParticipants,
  screenShareEnabled,
  screenShareHealth,
  screenShares,
  liveShares,
  watchingIdentities,
  localPreview,
  qualities,
  connectedAt,
  miniWindowSupported,
  miniWindowOpen,
  onToggleMic,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
  onToggleDeafen,
  onToggleScreenShare,
  onWatchShare,
  onStopWatchingShare,
  onReduceLocalQuality,
  onToggleMiniWindow,
  onLeave,
  onReturn,
}: Readonly<Props>) {
  const isConnected = status === "connected";
  const isAway = status === "away";
  const showsExitNotice = status === "idle" && exitNoticeReason !== null;
  const isSolo = tiles.length === 1;
  const gridLayout = gridLayoutFor(tiles.length);
  const canShare = useCanShareScreen();
  const deafenLabel = labelWithShortcut(
    deafen ? "Parar de ensurdecer" : "Ensurdecer",
    "toggle-deafen",
  );
  const micLabel = labelWithShortcut(micEnabled ? "Mutar" : "Desmutar", "toggle-mic");
  const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
  const hasScreenShares = screenShares.length > 0;
  if (!hasScreenShares && selectedShareId !== null) setSelectedShareId(null);
  const featuredId = hasScreenShares ? featuredShareId(selectedShareId, screenShares) : null;
  const featuredShare = screenShares.find((share) => share.id === featuredId);
  const featuredQuality = featuredShare ? qualities[featuredShare.identity] : undefined;
  const liveShareNames = new Map(liveShares.map((share) => [share.identity, share.name]));
  const { visible: stripVisible, toggle: toggleStrip } = useParticipantStripVisibility();
  const streamingIdentities = useMemo(
    () => new Set(screenShares.map((share) => share.identity)),
    [screenShares],
  );
  const showsStrip = hasScreenShares && shouldRenderStrip(stripVisible, tiles.length);
  const stripLabel = stripVisible ? "Ocultar participantes" : "Mostrar participantes";
  const healthMessage = screenShareHealthMessageFor(screenShareHealth);
  const showHealth =
    screenShareEnabled && healthMessage !== null && onReduceLocalQuality !== undefined;

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="relative flex min-h-0 flex-1 flex-col">
          {hasScreenShares ? (
            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ScreenShareStage
                  shares={screenShares}
                  featuredId={featuredId}
                  featuredQuality={featuredQuality}
                  onSelectShare={setSelectedShareId}
                  liveShares={liveShares}
                  watchingIdentities={watchingIdentities}
                  onWatchShare={onWatchShare}
                  onStopWatchingShare={onStopWatchingShare}
                />
              </div>
              {showsStrip && (
                <ParticipantStrip
                  tiles={tiles}
                  micEnabled={micEnabled}
                  deafen={deafen}
                  volumes={volumes}
                  screenShareVolumes={screenShareVolumes}
                  mutedParticipants={mutedParticipants}
                  deafenedParticipants={deafenedParticipants}
                  qualities={qualities}
                  streamingIdentities={streamingIdentities}
                  onSetVolume={onSetVolume}
                  onSetScreenShareVolume={onSetScreenShareVolume}
                  onToggleLocalMute={onToggleLocalMute}
                  onToggleLocalScreenShareMute={onToggleLocalScreenShareMute}
                />
              )}
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {showsExitNotice ? (
                <div
                  role="status"
                  className="flex h-full flex-col items-center justify-center gap-3 text-center"
                >
                  <p className="text-sm text-muted-foreground">
                    {exitNoticeTextFor(exitNoticeReason)}
                  </p>
                  <Button onClick={onReturn}>Entrar de novo</Button>
                </div>
              ) : status === "connecting" ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Conectando ao canal {roomName}...
                </div>
              ) : (
                <div
                  className={`mx-auto grid min-h-full w-full content-center grid-cols-1 gap-3 ${gridLayout}`}
                >
                  {tiles.map(({ identity, name, isLocal, isAway: isTileAway }, index) => (
                    <SpeakingParticipantTile
                      key={identity}
                      identity={identity}
                      name={name}
                      isLocal={isLocal}
                      isAway={isTileAway}
                      layoutClassName={tileLayoutFor(isSolo, tiles.length === 3 && index === 2)}
                      isMuted={isParticipantMuted({
                        identity,
                        isLocal,
                        micEnabled,
                        mutedParticipants,
                      })}
                      isDeafened={(isLocal && deafen) || deafenedParticipants[identity] === true}
                      isLocallyInaudible={isParticipantLocallyInaudible(isLocal, volumes[identity])}
                      quality={qualities[identity]}
                      liveShareName={liveShareNames.get(identity)}
                      isWatchPending={watchingIdentities.has(identity)}
                      volume={volumes[identity] ?? 1}
                      screenShareVolume={screenShareVolumes[identity] ?? 1}
                      isStreaming={screenShares.some((share) => share.identity === identity)}
                      onSetVolume={onSetVolume}
                      onSetScreenShareVolume={onSetScreenShareVolume}
                      onToggleLocalMute={onToggleLocalMute}
                      onToggleLocalScreenShareMute={onToggleLocalScreenShareMute}
                      onWatchShare={onWatchShare}
                      onStopWatchingShare={onStopWatchingShare}
                    />
                  ))}
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

        {isAway ? (
          <div className="relative flex shrink-0 items-center justify-center gap-3 border-t border-border px-4 py-3">
            <div role="status" className="min-w-0 text-center">
              <p className="text-sm font-medium text-foreground">{OWN_AWAY_TEXT}</p>
              {awayReason === "connection" && (
                <p className="text-xs text-muted-foreground">{exitNoticeTextFor("connection")}</p>
              )}
            </div>
            <Button onClick={onReturn}>Voltar</Button>
            <Button size="icon" variant="destructive" className="h-11 w-11" onClick={onLeave}>
              <PhoneOff className="h-4 w-4" />
              <span className="sr-only">Sair do canal de voz</span>
            </Button>
          </div>
        ) : (
          <div className="relative flex shrink-0 items-center justify-center gap-2 border-t border-border px-4 py-3">
            <CallDuration connectedAt={connectedAt} />
            <Button
              size="icon"
              variant={micEnabled ? "secondary" : "destructive"}
              className="h-11 w-11"
              onClick={onToggleMic}
              disabled={!isConnected}
              title={micLabel}
            >
              {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span className="sr-only">{micLabel}</span>
            </Button>

            <Button
              size="icon"
              variant={deafen ? "destructive" : "secondary"}
              className="h-11 w-11"
              onClick={onToggleDeafen}
              disabled={!isConnected}
              title={deafenLabel}
            >
              {deafen ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
              <span className="sr-only">{deafenLabel}</span>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden md:inline-flex">
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

            {miniWindowSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="hidden md:inline-flex">
                    <Button
                      size="icon"
                      variant={miniWindowOpen ? "default" : "secondary"}
                      className="h-11 w-11"
                      onClick={onToggleMiniWindow}
                      disabled={!isConnected}
                    >
                      <PictureInPicture2 className="h-4 w-4" />
                      <span className="sr-only">
                        {miniWindowOpen ? "Fechar mini janela de voz" : "Abrir mini janela de voz"}
                      </span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {miniWindowOpen ? "Fechar mini janela de voz" : "Abrir mini janela de voz"}
                </TooltipContent>
              </Tooltip>
            )}

            {hasScreenShares && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={stripVisible ? "default" : "secondary"}
                    className="h-11 w-11"
                    onClick={toggleStrip}
                  >
                    <Users className="h-4 w-4" />
                    <span className="sr-only">{stripLabel}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{stripLabel}</TooltipContent>
              </Tooltip>
            )}

            <Button size="icon" variant="destructive" className="h-11 w-11" onClick={onLeave}>
              <PhoneOff className="h-4 w-4" />
              <span className="sr-only">Sair do canal de voz</span>
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
