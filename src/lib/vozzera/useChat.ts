import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiError,
  createRoom as createRoomApi,
  deleteMessage as deleteMessageApi,
  listMessages,
  listRooms,
  logout as logoutApi,
  setUnauthorizedHandler,
} from "./api";
import { appendMessage, clearUnread, firstTextRoom, incrementUnread, totalUnread } from "./chat";
import type { ChatMessage, OutboundEvent, Room } from "./types";
import { fromEvent, fromHistory, ZERO_UUID } from "./types";
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
  const [unread, setUnread] = useState<Record<string, number>>({});
  const activeRoomRef = useRef(activeRoom);
  const roomsRef = useRef(rooms);

  activeRoomRef.current = activeRoom;
  roomsRef.current = rooms;

  const endSession = useCallback(() => {
    clearUsername();
    setAuthed(false);
    setRooms([]);
    setActiveRoom(null);
    setMessages({});
  }, [clearUsername]);

  useEffect(() => {
    setUnauthorizedHandler(endSession);

    return () => setUnauthorizedHandler(null);
  }, [endSession]);

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

    if (event.type !== "message" || event.room_id === ZERO_UUID) {
      return;
    }

    if (event.action === "deleted") {
      setMessages((prev) => ({
        ...prev,
        [event.room_id]: (prev[event.room_id] ?? []).filter((message) => message.id !== event.id),
      }));
      return;
    }

    if (event.action === "created") {
      setMessages((prev) => appendMessage(prev, fromEvent(event)));

      if (event.room_id !== activeRoomRef.current?.id) {
        setUnread((prev) => incrementUnread(prev, event.room_id));

        if (
          typeof document !== "undefined" &&
          document.hidden &&
          Notification.permission === "granted"
        ) {
          const room = roomsRef.current.find((r) => r.id === event.room_id);

          new Notification(`# ${room?.name ?? "Sala"}`, {
            body: `${event.username ?? "Alguém"}: ${event.content ?? ""}`,
          });
        }
      }

      return;
    }

    if (event.action === "updated") {
      setMessages((prev) => ({
        ...prev,
        [event.room_id]: (prev[event.room_id] ?? []).map((message) =>
          message.id === event.id
            ? {
                ...message,
                content: event.content,
                updatedAt: event.updated_at ? event.updated_at : message.updatedAt,
              }
            : message,
        ),
      }));
    }
  }, []);

  const { status, joinRoom, sendMessage } = useSocket({
    enabled: authed === true,
    onEvent: handleEvent,
    onSessionExpired: () => {
      endSession();
      setBanner("Sessão encerrada no servidor. Entre novamente.");
    },
  });

  const openRoom = useCallback(
    async (room: Room) => {
      if (room.type !== "text") return;

      setActiveRoom(room);
      setUnread((prev) => clearUnread(prev, room.id));
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

    if (first) {
      void openRoom(first);
    }
  }, [rooms, activeRoom, openRoom]);

  const createRoom = useCallback(
    async (name: string, type: "text" | "voice") => {
      const room = await createRoomApi(name, type);

      setRooms((prev) => [...prev, room]);

      if (room.type === "text") {
        void openRoom(room);
      }
    },
    [openRoom],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeRoom) return;

      try {
        await deleteMessageApi(activeRoom.id, messageId);

        setMessages((prev) => ({
          ...prev,
          [activeRoom.id]: (prev[activeRoom.id] ?? []).filter(
            (message) => message.id !== messageId,
          ),
        }));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthed(false);
          return;
        }

        setBanner("Não consegui excluir a mensagem.");
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

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // best-effort: estado local é limpo mesmo se o servidor não responder
    } finally {
      endSession();
    }
  }, [endSession]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const showBanner = useCallback((message: string) => setBanner(message), []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const baseTitle = "Vozzera — servidor privado de chat e voz";

  useEffect(() => {
    const render = () => {
      if (typeof document === "undefined") return;

      const count = totalUnread(unread);
      document.title = count > 0 && document.hidden ? `(${count}) ${baseTitle}` : baseTitle;
    };

    render();

    document.addEventListener("visibilitychange", render);
    window.addEventListener("focus", render);

    return () => {
      document.removeEventListener("visibilitychange", render);
      window.removeEventListener("focus", render);
    };
  }, [unread]);

  return {
    username,
    authed,
    rooms,
    activeRoom,
    messages,
    banner,
    loadingHistory,
    unread,
    socketStatus: status,
    openRoom,
    createRoom,
    deleteMessage,
    logout,
    authenticate,
    dismissBanner,
    showBanner,
    requestNotificationPermission,
    sendMessage,
  };
}
