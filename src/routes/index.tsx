import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AuthForm } from "@/components/vozzera/AuthForm";
import { CreateRoomDialog } from "@/components/vozzera/CreateRoomDialog";
import { MessageComposer } from "@/components/vozzera/MessageComposer";
import { MessageList } from "@/components/vozzera/MessageList";
import { RoomSidebar } from "@/components/vozzera/RoomSidebar";
import { ApiError, createRoom, listMessages, listRooms } from "@/lib/vozzera/api";
import { fromEvent, fromHistory, ZERO_UUID } from "@/lib/vozzera/types";
import type { ChatMessage, OutboundEvent, Room } from "@/lib/vozzera/types";
import { useAuth } from "@/lib/vozzera/useAuth";
import { useSocket } from "@/lib/vozzera/useSocket";
import { useVoice } from "@/lib/vozzera/useVoice";


const title = "Vozzera — servidor privado de chat e voz";
const description =
  "Chat em tempo real por convite: salas de texto, histórico e mensagens ao vivo para você e seus amigos.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { username, setUsername, clearUsername } = useAuth();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data);
      setAuthed(true);
      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthed(false);
      } else {
        setAuthed(false);
        setBanner("Não consegui falar com o servidor.");
      }
      return [];
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const handleEvent = useCallback((event: OutboundEvent) => {
    if (event.type === "error") {
      setBanner(event.error ?? "Erro no servidor.");
      return;
    }
    if (event.type !== "message") return;
    if (event.room_id === ZERO_UUID) return;

    const message = fromEvent(event);
    setMessages((prev) => {
      const current = prev[message.roomId] ?? [];
      if (current.some((m) => m.id === message.id)) return prev;
      return { ...prev, [message.roomId]: [...current, message] };
    });
  }, []);

  const { status, joinRoom, sendMessage } = useSocket({
    enabled: authed === true,
    onEvent: handleEvent,
  });

  const voice = useVoice();

  useEffect(() => {
    if (voice.error) setBanner(voice.error);
  }, [voice.error]);


  const openRoom = useCallback(
    async (room: Room) => {
      if (room.type !== "text") return;
      setActiveRoom(room);
      joinRoom(room.id);

      if (messages[room.id]) return;
      setLoadingHistory(true);
      try {
        const history = await listMessages(room.id, 50);
        setMessages((prev) => ({
          ...prev,
          [room.id]: history.map((m) => fromHistory(m, room.id)),
        }));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setAuthed(false);
        else setBanner("Não consegui carregar o histórico.");
      } finally {
        setLoadingHistory(false);
      }
    },
    [joinRoom, messages],
  );

  // seleciona a primeira sala de texto automaticamente
  useEffect(() => {
    if (activeRoom || rooms.length === 0) return;
    const first = rooms.find((r) => r.type === "text");
    if (first) void openRoom(first);
  }, [rooms, activeRoom, openRoom]);

  const handleCreateRoom = async (name: string, type: "text" | "voice") => {
    const room = await createRoom(name, type);
    setRooms((prev) => [...prev, room]);
    if (room.type === "text") void openRoom(room);
  };

  const handleLogout = () => {
    clearUsername();
    setAuthed(false);
    setRooms([]);
    setActiveRoom(null);
    setMessages({});
    setBanner("Estado local limpo. O servidor ainda não tem rota de logout.");
  };

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Conectando ao servidor...
      </div>
    );
  }

  if (!authed) {
    return (
      <AuthForm
        onAuthenticated={(name) => {
          setUsername(name);
          setBanner(null);
          void loadRooms();
        }}
      />
    );
  }

  const activeMessages = activeRoom ? (messages[activeRoom.id] ?? []) : [];

  return (
    <div className="flex h-screen bg-background">
      <RoomSidebar
        rooms={rooms}
        activeRoomId={activeRoom?.id ?? null}
        onSelectRoom={(room) => void openRoom(room)}
        onCreateRoom={() => setCreateOpen(true)}
        onLogout={handleLogout}
        username={username}
        status={status}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {activeRoom ? `# ${activeRoom.name}` : "Nenhuma sala selecionada"}
          </h1>
          <span className="text-xs text-muted-foreground">
            · todos os membros do servidor leem esta sala
          </span>
        </header>

        {banner && (
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
            <span>{banner}</span>
            <button onClick={() => setBanner(null)} className="underline">
              ok
            </button>
          </div>
        )}

        {activeRoom ? (
          <>
            <MessageList
              messages={activeMessages}
              loading={loadingHistory && activeMessages.length === 0}
              roomName={activeRoom.name}
            />
            <MessageComposer
              roomName={activeRoom.name}
              disabled={status !== "open"}
              onSend={(content) => sendMessage(activeRoom.id, content)}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground">Nenhuma sala de texto ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie a primeira no botão + da barra lateral.
              </p>
            </div>
          </div>
        )}
      </main>

      <CreateRoomDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingRooms={rooms}
        onCreate={handleCreateRoom}
      />
    </div>
  );
}
