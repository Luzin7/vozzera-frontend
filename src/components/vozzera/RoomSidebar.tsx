import { Hash, LogOut, Plus, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Room } from "@/lib/vozzera/types";
import type { SocketStatus } from "@/lib/vozzera/useSocket";

type Props = {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (room: Room) => void;
  onCreateRoom: () => void;
  onLogout: () => void;
  username: string | null;
  status: SocketStatus;
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
  onCreateRoom,
  onLogout,
  username,
  status,
}: Props) {
  const textRooms = rooms.filter((r) => r.type === "text");
  const voiceRooms = rooms.filter((r) => r.type === "voice");

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
            <button
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                room.id === activeRoomId
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <Hash className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </section>

        <section>
          <h2 className="px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Voz — em breve
          </h2>
          {voiceRooms.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Nenhum canal de voz.</p>
          )}
          {voiceRooms.map((room) => (
            <div
              key={room.id}
              title="Voz ainda não está disponível"
              className="flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground/60"
            >
              <Volume2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{room.name}</span>
            </div>
          ))}
        </section>
      </nav>

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
