import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  PictureInPicture2,
  Users,
  Video,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CallDuration } from "@/components/vozzera/CallDuration";
import { CameraSpotlight } from "@/components/vozzera/CameraSpotlight";
import { CameraStage } from "@/components/vozzera/CameraStage";
import { ParticipantStrip } from "@/components/vozzera/ParticipantStrip";
import { SpeakingParticipantTile } from "@/components/vozzera/SpeakingParticipantTile";
import { ScreenShareStage, LocalScreenPreview } from "@/components/vozzera/ScreenShareStage";
import type { LiveShare, WatchIntents } from "@/lib/vozzera/screen-share-watch";
import type { CameraDevice } from "@/lib/vozzera/camera";
import { CAMERA_SWITCH_TEXT } from "@/lib/vozzera/camera-errors";
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
  cameraOn: boolean;
  cameraAvailable: boolean;
  cameraMessage: string | null;
  cameraDevices: CameraDevice[];
  activeCameraDeviceId: string | null;
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
  sessionStartedAt: number | null;
  miniWindowSupported: boolean;
  miniWindowOpen: boolean;
  mobileChatOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectCameraDevice: (deviceId: string) => void;
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
  cameraOn,
  cameraAvailable,
  cameraMessage,
  cameraDevices,
  activeCameraDeviceId,
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
  sessionStartedAt,
  miniWindowSupported,
  miniWindowOpen,
  mobileChatOpen,
  onToggleMic,
  onToggleCamera,
  onSelectCameraDevice,
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
  const [spotlight, setSpotlight] = useState<{
    identity: string;
    name: string;
    opener: HTMLButtonElement;
  } | null>(null);
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
  const screenMessage = showHealth ? healthMessage : null;
  const hasCameraVideo = cameraOn || tiles.some((tile) => tile.cameraOn === true);
  const cameraLabel = cameraOn ? "Desligar câmera" : "Ligar câmera";
  const previousCameraMessageRef = useRef(cameraMessage);
  const previousScreenMessageRef = useRef(screenMessage);
  const [statusSource, setStatusSource] = useState<"camera" | "screen" | null>(null);

  useEffect(() => {
    const cameraChanged = previousCameraMessageRef.current !== cameraMessage;
    const screenChanged = previousScreenMessageRef.current !== screenMessage;
    previousCameraMessageRef.current = cameraMessage;
    previousScreenMessageRef.current = screenMessage;

    setStatusSource((current) => {
      if (screenChanged && screenMessage) return "screen";
      if (cameraChanged && cameraMessage) return "camera";
      if (current === "camera" && !cameraMessage) return screenMessage ? "screen" : null;
      if (current === "screen" && !screenMessage) return cameraMessage ? "camera" : null;
      if (current) return current;
      if (cameraMessage) return "camera";
      return screenMessage ? "screen" : null;
    });
  }, [cameraMessage, screenMessage]);

  const statusMessage = statusSource === "screen" ? screenMessage : cameraMessage;
  const openSpotlight = useCallback(
    (identity: string, opener: HTMLButtonElement) => {
      const participant = tiles.find((tile) => tile.identity === identity);
      if (!participant) return;
      setSpotlight({ identity, name: participant.name, opener });
    },
    [tiles],
  );
  const selectSpotlight = useCallback((participant: { identity: string; name: string }) => {
    setSpotlight((current) => (current ? { ...participant, opener: current.opener } : current));
  }, []);
  const closeSpotlight = useCallback(() => setSpotlight(null), []);

  return (
    <TooltipProvider>
      <div
        className={`min-h-0 flex-1 flex-col bg-background ${
          mobileChatOpen ? (hasCameraVideo ? "flex max-md:flex-none" : "hidden md:flex") : "flex"
        }`}
      >
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
            <>
              {isConnected && hasCameraVideo && (
                <CameraStage
                  participants={tiles.map(
                    ({ identity, name, isLocal, cameraOn: tileCameraOn }) => ({
                      identity,
                      name,
                      isLocal,
                      cameraOn: tileCameraOn === true,
                    }),
                  )}
                  cameraOn={cameraOn}
                  cameraDevices={cameraDevices}
                  activeCameraDeviceId={activeCameraDeviceId}
                  onSwitchCamera={onSelectCameraDevice}
                />
              )}
              <div
                className={`min-h-0 flex-1 overflow-y-auto p-4 ${
                  isConnected && hasCameraVideo ? "hidden md:block" : ""
                }`}
              >
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
                        cameraOn={tiles[index]?.cameraOn === true}
                        layoutClassName={tileLayoutFor(isSolo, tiles.length === 3 && index === 2)}
                        isMuted={isParticipantMuted({
                          identity,
                          isLocal,
                          micEnabled,
                          mutedParticipants,
                        })}
                        isDeafened={(isLocal && deafen) || deafenedParticipants[identity] === true}
                        isLocallyInaudible={isParticipantLocallyInaudible(
                          isLocal,
                          volumes[identity],
                        )}
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
                        onCameraActivate={openSpotlight}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
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

          {spotlight && (
            <CameraSpotlight
              participant={spotlight}
              participants={tiles.map(({ identity, name }) => ({ identity, name }))}
              opener={spotlight.opener}
              onSelect={selectSpotlight}
              onClose={closeSpotlight}
            />
          )}
        </div>

        {statusMessage && (
          <div
            role="status"
            aria-live="polite"
            className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground"
          >
            <span>{statusMessage}</span>
            {statusSource === "screen" && showHealth && (
              <Button size="sm" variant="secondary" onClick={() => onReduceLocalQuality?.()}>
                Mudar para Economia
              </Button>
            )}
          </div>
        )}

        {isAway ? (
          <div className="relative z-50 flex shrink-0 items-center justify-center gap-3 border-t border-border bg-background px-4 py-3">
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
          <div className="relative z-50 flex shrink-0 items-center justify-center gap-2 border-t border-border bg-background px-4 py-3">
            <CallDuration
              startedAt={sessionStartedAt}
              className="absolute left-4 hidden font-mono text-xs tabular-nums text-muted-foreground md:block"
            />
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

            <div className="flex items-center">
              <Button
                size="icon"
                variant={cameraOn ? "default" : "secondary"}
                className={`h-11 w-11 ${cameraOn && cameraDevices.length > 1 ? "md:rounded-r-none" : ""}`}
                onClick={onToggleCamera}
                disabled={!isConnected || !cameraAvailable}
                aria-pressed={cameraOn}
                title={cameraLabel}
              >
                {cameraOn ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                <span className="sr-only">{cameraLabel}</span>
              </Button>
              {cameraOn && cameraDevices.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      className="hidden h-11 w-8 rounded-l-none border-l border-primary-foreground/20 md:inline-flex"
                      title={CAMERA_SWITCH_TEXT}
                    >
                      <ChevronDown className="h-4 w-4" />
                      <span className="sr-only">{CAMERA_SWITCH_TEXT}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="center">
                    {cameraDevices.map((device) => (
                      <DropdownMenuItem
                        key={device.deviceId}
                        onSelect={() => onSelectCameraDevice(device.deviceId)}
                      >
                        <Check
                          className={`h-4 w-4 ${device.deviceId === activeCameraDeviceId ? "opacity-100" : "opacity-0"}`}
                        />
                        <span>{device.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

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
                  <span className="hidden md:inline-flex">
                    <Button
                      size="icon"
                      variant={stripVisible ? "default" : "secondary"}
                      className="h-11 w-11"
                      onClick={toggleStrip}
                    >
                      <Users className="h-4 w-4" />
                      <span className="sr-only">{stripLabel}</span>
                    </Button>
                  </span>
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
