import { Hash, LogOut, Mic, MicOff, PhoneOff, Plus, Volume2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Room } from "@/lib/vozzera/types";
import type { SocketStatus } from "@/lib/vozzera/useSocket";
import type { VoiceStatus } from "@/lib/vozzera/useVoice";

type Props = {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (room: Room) => void;
  onSelectVoiceRoom: (room: Room) => void;
  onCreateRoom: () => void;
  onLogout: () => void;
  username: string | null;
  status: SocketStatus;
  voiceStatus: VoiceStatus;
  voiceRoomId: string | null;
  voiceParticipants: string[];
  micEnabled: boolean;
  onToggleMic: () => void;
  onLeaveVoice: () => void;
  onDeleteRoom: (room: Room) => void;
};

const statusLabel: Record<SocketStatus, string> = {
  open: "conectado",
  connecting: "conectando",
  closed: "offline",
};

export function RoomSidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onSelectVoiceRoom,
  onCreateRoom,
  onDeleteRoom,
  onLogout,
  username,
  status,
  voiceStatus,
  voiceRoomId,
  voiceParticipants,
  micEnabled,
  onToggleMic,
  onLeaveVoice,
}: Props) {
  const textRooms = rooms.filter((r) => r.type === "text");
  const voiceRooms = rooms.filter((r) => r.type === "voice");
  const currentVoiceRoom = voiceRooms.find((r) => r.id === voiceRoomId) ?? null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <span className="font-semibold tracking-tight text-sidebar-foreground">Vozzera</span>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCreateRoom}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">Nova sala</span>
        </Button>
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
            <div key={room.id} className="group flex items-center rounded-md">
              <button
                onClick={() => onSelectRoom(room)}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                  room.id === activeRoomId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Hash className="h-4 w-4 shrink-0 opacity-70" />
                <span className="truncate">{room.name}</span>
              </button>

              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();

                  if (window.confirm(`Excluir a sala "${room.name}"?`)) {
                    onDeleteRoom(room);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Excluir {room.name}</span>
              </Button>
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
            const isActive = room.id === voiceRoomId;
            return (
              <div key={room.id}>
                <button
                  onClick={() => onSelectVoiceRoom(room)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  <Volume2 className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{room.name}</span>
                  {isActive && voiceStatus === "connecting" && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      conectando…
                    </span>
                  )}
                </button>
                {isActive && voiceStatus === "connected" && voiceParticipants.length > 0 && (
                  <ul className="mb-1 ml-8 space-y-0.5">
                    {voiceParticipants.map((name) => (
                      <li
                        key={name}
                        className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"
                      >
                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>
      </nav>

      {currentVoiceRoom && voiceStatus !== "idle" && (
        <div className="border-t border-sidebar-border px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-primary">
                {voiceStatus === "connected" ? "Voz conectada" : "Conectando…"}
              </p>
              <p className="truncate text-xs text-muted-foreground">{currentVoiceRoom.name}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onToggleMic}
                disabled={voiceStatus !== "connected"}
              >
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                <span className="sr-only">{micEnabled ? "Silenciar" : "Ativar microfone"}</span>
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onLeaveVoice}>
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
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  status === "open"
                    ? "bg-primary"
                    : status === "connecting"
                      ? "bg-muted-foreground"
                      : "bg-destructive"
                }`}
              />
              {statusLabel[status]}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Sair</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
