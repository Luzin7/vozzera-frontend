import {
  Ear,
  EarOff,
  Hash,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Plus,
  Settings,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { memo, useRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ParticipantMenu } from "@/components/vozzera/ParticipantMenu";
import { VoicePresenceList } from "@/components/vozzera/VoicePresenceList";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/vozzera/avatar";
import { nextRoomIndex, type VoicePresence } from "@/lib/vozzera/chat";
import type { Room } from "@/lib/vozzera/types";
import type { SocketStatus } from "@/lib/vozzera/useSocket";
import { useCanShareScreen } from "@/lib/vozzera/use-can-share-screen";
import type { ScreenShare, VoiceStatus } from "@/lib/vozzera/useVoice";
import { isParticipantLocallyInaudible } from "@/lib/vozzera/voice";

type Props = {
  className?: string;
  loading?: boolean;
  rooms: Room[];
  activeRoomId: string | null;
  visibleVoiceRoomId: string | null;
  onSelectRoom: (room: Room) => void;
  onSelectVoiceRoom: (room: Room) => void;
  onCreateRoom: () => void;
  canManageRooms: boolean;
  onOpenVoiceChat: (room: Room) => void;
  onOpenRoomSettings: (room: Room) => void;
  voiceChatOpen: boolean;
  settingsRoomId: string | null;
  onOpenSettings: () => void;
  username: string | null;
  currentUserId: string | null;
  status: SocketStatus;
  voiceStatus: VoiceStatus;
  voiceRoomId: string | null;
  voiceParticipants: string[];
  voicePresence: VoicePresence;
  micEnabled: boolean;
  onToggleMic: () => void;
  onLeaveVoice: () => void;
  unread: Record<string, number>;
  volumes: Record<string, number>;
  screenShareVolumes: Record<string, number>;
  onSetVolume: (name: string, volume: number) => void;
  onSetScreenShareVolume: (name: string, volume: number) => void;
  onToggleLocalMute: (name: string) => void;
  onToggleLocalScreenShareMute: (name: string) => void;
  onListenToParticipant: (name: string, volume?: number) => void;
  onListenToParticipantScreenShare: (name: string, volume?: number) => void;
  screenShareEnabled: boolean;
  onToggleScreenShare: () => void;
  screenShares: ScreenShare[];
  mutedParticipants: Record<string, boolean>;
  speakingNames: string[];
  deafen: boolean;
  onToggleDeafen: () => void;
};

const statusLabel: Record<SocketStatus, string> = {
  open: "conectado",
  connecting: "conectando",
  closed: "offline",
};

const statusColor: Record<SocketStatus, string> = {
  open: "bg-primary",
  connecting: "bg-muted-foreground",
  closed: "bg-destructive",
};

function RoomRowActions({
  room,
  connected,
  chatOpen,
  settingsOpen,
  canManageRooms,
  onOpenChat,
  onOpenSettings,
}: Readonly<{
  room: Room;
  connected: boolean;
  chatOpen: boolean;
  settingsOpen: boolean;
  canManageRooms: boolean;
  onOpenChat?: () => void;
  onOpenSettings: () => void;
}>) {
  return (
    <div className="absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 pr-1 opacity-100 transition-opacity md:right-1 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
      {connected && onOpenChat && (
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 shrink-0 text-muted-foreground/60 transition-colors hover:bg-foreground/15 hover:text-foreground [&_svg]:size-3.5",
            chatOpen && "text-primary hover:text-primary",
          )}
          onClick={onOpenChat}
        >
          <MessageSquare />
          <span className="sr-only">Chat da call {room.name}</span>
        </Button>
      )}
      {canManageRooms && (
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-7 w-7 shrink-0 text-muted-foreground/60 transition-colors hover:bg-foreground/15 hover:text-foreground [&_svg]:size-3.5",
            settingsOpen && "text-primary hover:text-primary",
          )}
          onClick={onOpenSettings}
        >
          <Settings />
          <span className="sr-only">Configurações da sala {room.name}</span>
        </Button>
      )}
    </div>
  );
}

export const RoomSidebar = memo(function RoomSidebar({
  className,
  loading = false,
  rooms,
  activeRoomId,
  visibleVoiceRoomId,
  onSelectRoom,
  onSelectVoiceRoom,
  onCreateRoom,
  canManageRooms,
  onOpenVoiceChat,
  onOpenRoomSettings,
  voiceChatOpen,
  settingsRoomId,
  onOpenSettings,
  username,
  currentUserId,
  status,
  voiceStatus,
  voiceRoomId,
  voiceParticipants,
  voicePresence,
  micEnabled,
  onToggleMic,
  onLeaveVoice,
  unread,
  volumes,
  screenShareVolumes,
  onSetVolume,
  onSetScreenShareVolume,
  onToggleLocalMute,
  onToggleLocalScreenShareMute,
  onListenToParticipant,
  onListenToParticipantScreenShare,
  screenShareEnabled,
  onToggleScreenShare,
  screenShares,
  mutedParticipants,
  speakingNames,
  deafen,
  onToggleDeafen,
}: Readonly<Props>) {
  const sidebarRef = useRef<HTMLElement>(null);
  const canShare = useCanShareScreen();
  const textRooms = rooms.filter((r) => !r.has_voice);
  const voiceRooms = rooms.filter((r) => r.has_voice);
  const currentVoiceRoom = voiceRooms.find((r) => r.id === voiceRoomId) ?? null;

  const focusRoom = (event: KeyboardEvent<HTMLButtonElement>, group: string) => {
    const buttons = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLButtonElement>(`[data-room-nav="${group}"]`) ?? [],
    );
    const currentIndex = buttons.indexOf(event.currentTarget);
    const nextIndex = nextRoomIndex(event.key, currentIndex, buttons.length);

    if (nextIndex === null) return;

    event.preventDefault();
    buttons[nextIndex]?.focus();
  };

  if (loading) {
    return (
      <aside
        className={cn("flex w-60 shrink-0 flex-col border-r border-border bg-sidebar", className)}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 pr-16 md:pr-4">
          <span className="font-semibold tracking-tight text-sidebar-foreground">Vozzera</span>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-2">
          <section>
            <Skeleton className="mb-2 ml-2 mt-1 h-3 w-14" />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="mb-1.5 h-9 w-full" />
            ))}
          </section>
          <section>
            <Skeleton className="mb-2 ml-2 mt-1 h-3 w-14" />
            <Skeleton className="mb-1.5 h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </section>
          <section>
            <Skeleton className="mb-2 ml-2 mt-1 h-3 w-14" />
            <Skeleton className="mb-1.5 h-9 w-full" />
          </section>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      className={cn("flex w-60 shrink-0 flex-col border-r border-border bg-sidebar", className)}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 pr-16 md:pr-4">
        <span className="font-semibold tracking-tight text-sidebar-foreground">Vozzera</span>
        {canManageRooms && (
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 text-muted-foreground/60 transition-colors hover:bg-foreground/15 hover:text-foreground md:h-7 md:w-7"
            onClick={onCreateRoom}
          >
            <Plus />
            <span className="sr-only">Nova sala</span>
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-2">
        <section>
          <h2 className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Texto
          </h2>
          {textRooms.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Nenhuma sala ainda.</p>
          )}
          {textRooms.map((room) => (
            <div key={room.id} className="group relative rounded-md py-0.5">
              <Button
                variant="ghost"
                data-room-nav="text"
                onClick={() => onSelectRoom(room)}
                onKeyDown={(event) => focusRoom(event, "text")}
                className={`flex min-h-11 w-full min-w-0 justify-start gap-2 rounded-md py-1.5 pl-2 pr-12 text-sm transition-colors md:min-h-0 md:pr-10 ${
                  room.id === activeRoomId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Hash className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{room.name}</span>
                {room.staff_only && (
                  <span className="inline-flex shrink-0" title="Só para moderação">
                    <Lock aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                    <span className="sr-only">Só para moderação</span>
                  </span>
                )}
                {unread[room.id] ? (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {unread[room.id]}
                  </span>
                ) : null}
              </Button>
              {canManageRooms && (
                <RoomRowActions
                  room={room}
                  connected={false}
                  chatOpen={false}
                  settingsOpen={settingsRoomId === room.id}
                  canManageRooms={canManageRooms}
                  onOpenSettings={() => onOpenRoomSettings(room)}
                />
              )}
            </div>
          ))}
        </section>

        <section>
          <h2 className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Voz
          </h2>
          {voiceRooms.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum canal de voz.</p>
          )}
          {voiceRooms.map((room) => {
            const isConnected = room.id === voiceRoomId;
            const isSelected = room.id === visibleVoiceRoomId;
            const onlineParticipants = voicePresence[room.id] ?? [];
            return (
              <div key={room.id} className="group flex flex-col rounded-md py-0.5">
                <div className="relative">
                  <Button
                    variant="ghost"
                    data-room-nav="voice"
                    onClick={() => onSelectVoiceRoom(room)}
                    onKeyDown={(event) => focusRoom(event, "voice")}
                    className={`flex min-h-11 w-full min-w-0 items-center justify-start gap-2 rounded-md py-1.5 pl-2 pr-16 text-sm transition-colors md:min-h-0 md:pr-14 ${
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    }`}
                  >
                    <Volume2 className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{room.name}</span>
                    {room.staff_only && (
                      <span className="inline-flex shrink-0" title="Só para moderação">
                        <Lock aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                        <span className="sr-only">Só para moderação</span>
                      </span>
                    )}
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {unread[room.id] ? (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                          {unread[room.id]}
                        </span>
                      ) : null}
                      {isConnected && voiceStatus === "connecting" && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          conectando…
                        </span>
                      )}
                    </span>
                  </Button>
                  {(isConnected || canManageRooms) && (
                    <RoomRowActions
                      room={room}
                      connected={isConnected}
                      chatOpen={voiceChatOpen && isSelected}
                      settingsOpen={settingsRoomId === room.id}
                      canManageRooms={canManageRooms}
                      onOpenChat={() => onOpenVoiceChat(room)}
                      onOpenSettings={() => onOpenRoomSettings(room)}
                    />
                  )}
                </div>

                {isConnected && voiceStatus === "connected" && voiceParticipants.length > 0 && (
                  <ul className="mb-1 ml-8 mt-1.5 space-y-2">
                    {voiceParticipants.map((name) => {
                      const isSpeaking = speakingNames.includes(name);
                      const isMuted =
                        name === username ? !micEnabled : mutedParticipants[name] === true;
                      const isStreaming =
                        name === username
                          ? screenShareEnabled
                          : screenShares.some((share) => share.name === name);
                      const isLocalMuted = name !== username && volumes[name] === 0;
                      const isLocallyInaudible = isParticipantLocallyInaudible(
                        name === username,
                        deafen,
                        volumes[name],
                      );
                      const isScreenShareLocallyMuted =
                        name !== username && screenShareVolumes[name] === 0;

                      const row = (
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className={`inline-flex shrink-0 rounded-full p-0.5 ${
                              isSpeaking ? "bg-primary" : "bg-transparent"
                            }`}
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-foreground">
                              {initials(name)}
                            </span>
                          </span>
                          <span className="truncate">{name}</span>
                          {isMuted && <MicOff className="h-3 w-3 shrink-0 text-destructive" />}
                          {isStreaming && <MonitorUp className="h-3 w-3 shrink-0 text-primary" />}
                          {isLocallyInaudible && (
                            <span
                              className="inline-flex shrink-0"
                              title={deafen ? "Silenciado pelo mudo total" : "Silenciado para você"}
                            >
                              <VolumeX
                                aria-hidden="true"
                                className="h-3 w-3 text-muted-foreground"
                              />
                              <span className="sr-only">
                                {deafen ? "Silenciado pelo mudo total" : "Silenciado para você"}
                              </span>
                            </span>
                          )}
                        </span>
                      );

                      return (
                        <li key={name} className="text-xs text-muted-foreground">
                          {name === username ? (
                            row
                          ) : (
                            <ParticipantMenu
                              name={name}
                              volume={volumes[name] ?? 1}
                              screenShareVolume={screenShareVolumes[name] ?? 1}
                              deafen={deafen}
                              locallyMuted={isLocalMuted}
                              screenShareLocallyMuted={isScreenShareLocallyMuted}
                              isMuted={isMuted}
                              isStreaming={isStreaming}
                              isSpeaking={isSpeaking}
                              onSetVolume={(volume) => {
                                if (deafen) {
                                  onListenToParticipant(name, volume);
                                  return;
                                }
                                onSetVolume(name, volume);
                              }}
                              onSetScreenShareVolume={(volume) => {
                                if (deafen) {
                                  onListenToParticipantScreenShare(name, volume);
                                  return;
                                }
                                onSetScreenShareVolume(name, volume);
                              }}
                              onToggleLocalMute={() => {
                                if (deafen) {
                                  onListenToParticipant(name);
                                  return;
                                }
                                onToggleLocalMute(name);
                              }}
                              onToggleLocalScreenShareMute={() => {
                                if (deafen) {
                                  onListenToParticipantScreenShare(name);
                                  return;
                                }
                                onToggleLocalScreenShareMute(name);
                              }}
                            >
                              {row}
                            </ParticipantMenu>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {(!isConnected ||
                  voiceStatus !== "connected" ||
                  voiceParticipants.length === 0) && (
                  <VoicePresenceList
                    participants={onlineParticipants}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            );
          })}
        </section>
      </nav>

      {currentVoiceRoom && voiceStatus !== "idle" && (
        <div className="border-t border-sidebar-border px-2 py-2 sm:px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-primary">
                {voiceStatus === "connected" ? "Voz conectada" : "Conectando…"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{currentVoiceRoom.name}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-11 w-11 md:h-7 md:w-7"
                        onClick={onToggleScreenShare}
                        disabled={voiceStatus !== "connected" || !canShare}
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
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 md:h-7 md:w-7"
                onClick={onToggleDeafen}
                disabled={voiceStatus !== "connected"}
              >
                {deafen ? <EarOff className="h-4 w-4" /> : <Ear className="h-4 w-4" />}
                <span className="sr-only">{deafen ? "Ativar som" : "Mudo total"}</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 md:h-7 md:w-7"
                onClick={onToggleMic}
                disabled={voiceStatus !== "connected"}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span className="sr-only">{micEnabled ? "Silenciar" : "Ativar microfone"}</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 md:h-7 md:w-7"
                onClick={onLeaveVoice}
              >
                <PhoneOff className="h-4 w-4" />
                <span className="sr-only">Sair do canal de voz</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {username ?? "você"}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusColor[status]}`} />
              {statusLabel[status]}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 text-muted-foreground/60 transition-colors hover:bg-foreground/15 hover:text-foreground md:h-7 md:w-7"
            onClick={onOpenSettings}
          >
            <Settings2 />
            <span className="sr-only">Configurações</span>
          </Button>
        </div>
      </div>
    </aside>
  );
});
