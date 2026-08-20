import {
  Hash,
  Mic,
  MicOff,
  MoreHorizontal,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Plus,
  Pencil,
  Settings2,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { memo, type KeyboardEvent, useRef, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ParticipantMenu } from "@/components/vozzera/ParticipantMenu";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/lib/vozzera/avatar";
import { nextRoomIndex } from "@/lib/vozzera/chat";
import type { Room } from "@/lib/vozzera/types";
import { cn } from "@/lib/utils";
import type { ScreenShare } from "@/lib/vozzera/useVoice";
import type { SocketStatus } from "@/lib/vozzera/useSocket";
import type { VoiceStatus } from "@/lib/vozzera/useVoice";

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
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (room: Room) => void;
  onOpenSettings: () => void;
  username: string | null;
  status: SocketStatus;
  voiceStatus: VoiceStatus;
  voiceRoomId: string | null;
  voiceParticipants: string[];
  micEnabled: boolean;
  onToggleMic: () => void;
  onLeaveVoice: () => void;
  unread: Record<string, number>;
  volumes: Record<string, number>;
  onSetVolume: (name: string, volume: number) => void;
  onToggleLocalMute: (name: string) => void;
  screenShareEnabled: boolean;
  onToggleScreenShare: () => void;
  screenShares: ScreenShare[];
  mutedParticipants: Record<string, boolean>;
  speakingNames: string[];
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

function RoomActions({
  room,
  onEdit,
  onDelete,
}: Readonly<{
  room: Room;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="group/action absolute right-0 top-1/2 z-10 h-11 w-11 shrink-0 -translate-y-1/2 p-0 opacity-100 transition-opacity hover:bg-transparent md:right-1 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md group-hover/action:bg-sidebar-accent">
            <MoreHorizontal className="h-4 w-4" />
          </span>
          <span className="sr-only">Ações da sala {room.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Editar sala
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          Apagar sala
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  onEditRoom,
  onDeleteRoom,
  onOpenSettings,
  username,
  status,
  voiceStatus,
  voiceRoomId,
  voiceParticipants,
  micEnabled,
  onToggleMic,
  onLeaveVoice,
  unread,
  volumes,
  onSetVolume,
  onToggleLocalMute,
  screenShareEnabled,
  onToggleScreenShare,
  screenShares,
  mutedParticipants,
  speakingNames,
}: Readonly<Props>) {
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const textRooms = rooms.filter((r) => r.type === "text");
  const voiceRooms = rooms.filter((r) => r.type === "voice");
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
            className="h-11 w-11 md:h-7 md:w-7"
            onClick={onCreateRoom}
          >
            <Plus className="h-4 w-4" />
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
                {unread[room.id] ? (
                  <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                    {unread[room.id]}
                  </span>
                ) : null}
              </Button>
              {canManageRooms && (
                <RoomActions
                  room={room}
                  onEdit={() => onEditRoom(room)}
                  onDelete={() => setDeleteTarget(room)}
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
            return (
              <div key={room.id} className="group flex flex-col rounded-md py-0.5">
                <div className="relative">
                  <Button
                    variant="ghost"
                    data-room-nav="voice"
                    onClick={() => onSelectVoiceRoom(room)}
                    onKeyDown={(event) => focusRoom(event, "voice")}
                    className={`flex min-h-11 w-full min-w-0 items-center justify-start gap-2 rounded-md py-1.5 pl-2 pr-12 text-sm transition-colors md:min-h-0 md:pr-10 ${
                      isSelected
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    }`}
                  >
                    <Volume2 className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{room.name}</span>
                    {isConnected && voiceStatus === "connecting" && (
                      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        conectando…
                      </span>
                    )}
                  </Button>
                  {canManageRooms && (
                    <RoomActions
                      room={room}
                      onEdit={() => onEditRoom(room)}
                      onDelete={() => setDeleteTarget(room)}
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
                          {isLocalMuted && (
                            <VolumeX className="h-3 w-3 shrink-0 text-muted-foreground" />
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
                              locallyMuted={isLocalMuted}
                              isMuted={isMuted}
                              isStreaming={isStreaming}
                              isSpeaking={isSpeaking}
                              onSetVolume={(volume) => onSetVolume(name, volume)}
                              onToggleLocalMute={() => onToggleLocalMute(name)}
                            >
                              {row}
                            </ParticipantMenu>
                          )}
                        </li>
                      );
                    })}
                  </ul>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11 md:h-7 md:w-7"
                onClick={onToggleScreenShare}
                disabled={voiceStatus !== "connected"}
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
            className="h-11 w-11 md:h-7 md:w-7"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
            <span className="sr-only">Configurações</span>
          </Button>
        </div>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar sala?</AlertDialogTitle>
            <AlertDialogDescription>
              A sala {deleteTarget?.name} e todo o histórico dela serão apagados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                onDeleteRoom(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Apagar sala
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
});
