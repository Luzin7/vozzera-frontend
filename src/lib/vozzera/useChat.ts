import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  createRoom as createRoomApi,
  deleteRoom as deleteRoomApi,
  listMessages,
  listRooms,
} from "./api";
import { appendMessage, firstTextRoom } from "./chat";
import { fromEvent, fromHistory, ZERO_UUID } from "./types";
import type { ChatMessage, OutboundEvent, Room } from "./types";
import { useAuth } from "./useAuth";
import { useSocket } from "./useSocket";

export function useChat() {
  const { username, setUsername, clearUsername } = useAuth();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await listRooms());
      setAuthed(true);
    } catch (err) {
      setAuthed(false);
      if (err instanceof ApiError && err.status === 401) return;
      setBanner("Não consegui falar com o servidor.");
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
    if (event.type !== "message" || event.room_id === ZERO_UUID) return;
    setMessages((prev) => appendMessage(prev, fromEvent(event)));
  }, []);

  const { status, joinRoom, sendMessage } = useSocket({
    enabled: authed === true,
    onEvent: handleEvent,
  });

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
        if (err instanceof ApiError && err.status === 401) {
          setAuthed(false);
          return;
        }
        setBanner("Não consegui carregar o histórico.");
      } finally {
        setLoadingHistory(false);
      }
    },
    [joinRoom, messages],
  );

  useEffect(() => {
    if (activeRoom || rooms.length === 0) return;
    const first = firstTextRoom(rooms);
    if (first) void openRoom(first);
  }, [rooms, activeRoom, openRoom]);

  const createRoom = useCallback(
    async (name: string, type: "text" | "voice") => {
      const room = await createRoomApi(name, type);
      setRooms((prev) => [...prev, room]);
      if (room.type === "text") void openRoom(room);
    },
    [openRoom],
  );

  const deleteRoom = useCallback(
    async (room: Room) => {
      try {
        await deleteRoomApi(room.id);
        setRooms((prev) => prev.filter((r) => r.id !== room.id));
        if (activeRoom?.id === room.id) setActiveRoom(null);
        setMessages((prev) => {
          const next = { ...prev };
          delete next[room.id];
          return next;
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthed(false);
          return;
        }
        setBanner("Não consegui excluir a sala.");
      }
    },
    [activeRoom],
  );

  const authenticate = useCallback(
    (name: string) => {
      setUsername(name);
      setBanner(null);
      void loadRooms();
    },
    [setUsername, loadRooms],
  );

  const logout = useCallback(() => {
    clearUsername();
    setAuthed(false);
    setRooms([]);
    setActiveRoom(null);
    setMessages({});
    setBanner("Estado local limpo. O servidor ainda não tem rota de logout.");
  }, [clearUsername]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const showBanner = useCallback((message: string) => setBanner(message), []);

  return {
    username,
    authed,
    rooms,
    activeRoom,
    messages,
    banner,
    loadingHistory,
    socketStatus: status,
    openRoom,
    createRoom,
    deleteRoom,
    logout,
    authenticate,
    dismissBanner,
    showBanner,
    sendMessage,
  };
}
