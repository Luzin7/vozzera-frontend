import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  ApiError,
  createRoom as createRoomApi,
  deleteMessage as deleteMessageApi,
  deleteRoom as deleteRoomApi,
  getCurrentUser,
  listMessages,
  listRooms,
  logout as logoutApi,
  setUnauthorizedHandler,
  updateEmail as updateEmailApi,
  updateRoom as updateRoomApi,
} from "@/lib/vozzera/api";
import {
  appendMessage,
  clearActiveRoomId,
  clearUnread,
  expireTypingUsers,
  firstTextRoom,
  incrementUnread,
  readActiveRoomId,
  removeRoom,
  sortRooms,
  totalUnread,
  updateTypingUsers,
  updateVoicePresence,
  upsertRoom,
  writeActiveRoomId,
} from "@/lib/vozzera/chat";
import type { TypingUsers, VoicePresence } from "@/lib/vozzera/chat";
import {
  canNotify,
  initialNotificationsEnabled,
  notificationPermissionGranted,
  playMessageSound,
  readSoundEnabled,
  writeNotificationsEnabled,
  writeSoundEnabled,
} from "@/lib/vozzera/notifications";
import { canManageRooms, canModerateMessages } from "@/lib/vozzera/permissions";
import type { ChatMessage, CurrentUser, OutboundEvent, Room, UserRole } from "@/lib/vozzera/types";
import { fromEvent, fromHistory, ZERO_UUID } from "@/lib/vozzera/types";
import { useAuth } from "@/lib/vozzera/useAuth";
import { useSocket } from "@/lib/vozzera/useSocket";

const TYPING_EVENT_INTERVAL_MS = 1000;
const TYPING_EXPIRATION_MS = 3000;

export function useChat() {
  const { username, setUsername, clearUsername } = useAuth();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<TypingUsers>({});
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return initialNotificationsEnabled(localStorage);
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return readSoundEnabled(localStorage);
  });
  const activeRoomRef = useRef(activeRoom);
  const roomsRef = useRef(rooms);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const selectedInitialRoomRef = useRef(false);
  const typingRoomRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeRoomRef.current = activeRoom;
  roomsRef.current = rooms;
  notificationsEnabledRef.current = notificationsEnabled;
  soundEnabledRef.current = soundEnabled;

  const endSession = useCallback(() => {
    clearUsername();
    setAuthed(false);
    setRooms([]);
    setRole(null);
    setEmail(null);
    setCurrentUserId(null);
    setActiveRoom(null);
    setMessages({});
    setTypingUsers({});
    setVoicePresence({});
    selectedInitialRoomRef.current = false;
    clearActiveRoomId(typeof localStorage === "undefined" ? null : localStorage);
    queryClient.removeQueries({ queryKey: ["rooms"] });
    queryClient.removeQueries({ queryKey: ["me"] });
  }, [clearUsername, queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(endSession);

    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const loadSession = useCallback(async () => {
    try {
      const [nextRooms, currentUser] = await Promise.all([
        queryClient.ensureQueryData({
          queryKey: ["rooms"],
          queryFn: listRooms,
          staleTime: 30_000,
        }),
        queryClient.ensureQueryData({
          queryKey: ["me"],
          queryFn: getCurrentUser,
          staleTime: 5 * 60_000,
        }),
      ]);
      const sortedRooms = sortRooms(nextRooms);
      setRooms(sortedRooms);
      queryClient.setQueryData<Room[]>(["rooms"], sortedRooms);
      setUsername(currentUser.username);
      setRole(currentUser.role);
      setEmail(currentUser.email);
      setCurrentUserId(currentUser.id);
      setAuthed(true);
    } catch (err) {
      setAuthed(false);

      if (err instanceof ApiError && err.status === 401) return;

      setBanner("Não consegui falar com o servidor.");
    }
  }, [queryClient, setUsername]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const removeRoomLocally = useCallback((roomId: string) => {
    setRooms((prev) => prev.filter((room) => room.id !== roomId));
    setMessages((prev) => removeRoom(prev, roomId));
    setUnread((prev) => removeRoom(prev, roomId));
    setTypingUsers((prev) => removeRoom(prev, roomId));
    setVoicePresence((prev) => removeRoom(prev, roomId));
    setActiveRoom((current) => (current?.id === roomId ? null : current));
  }, []);

  const handleRoomEvent = useCallback(
    (event: Extract<OutboundEvent, { type: "room" }>) => {
      if (event.action === "deleted") {
        removeRoomLocally(event.id);
        queryClient.setQueryData<Room[]>(["rooms"], (prev) =>
          prev?.filter((room) => room.id !== event.id),
        );
        return;
      }

      const current = roomsRef.current.find((room) => room.id === event.id);
      const room: Room = {
        id: event.id,
        name: event.name,
        type: event.room_type,
        created_at: event.created_at,
        updated_at: current?.updated_at ?? null,
      };

      setRooms((prev) => upsertRoom(prev, room));
      queryClient.setQueryData<Room[]>(["rooms"], (prev) => upsertRoom(prev ?? [], room));
      setActiveRoom((active) => (active?.id === room.id ? { ...active, ...room } : active));
    },
    [queryClient, removeRoomLocally],
  );

  const handleMessageEvent = useCallback((event: Extract<OutboundEvent, { type: "message" }>) => {
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
          canNotify(notificationsEnabledRef.current, document.hidden)
        ) {
          const room = roomsRef.current.find((r) => r.id === event.room_id);

          new Notification(`# ${room?.name ?? "Sala"}`, {
            body: `${event.username ?? "Alguém"}: ${event.content ?? ""}`,
          });
        }

        if (typeof document !== "undefined" && soundEnabledRef.current) {
          playMessageSound();
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

  const handleEvent = useCallback(
    (event: OutboundEvent) => {
      if (event.type === "error") {
        setBanner(event.error ?? "Erro no servidor.");
        return;
      }

      if (event.type === "room") {
        handleRoomEvent(event);
        return;
      }

      if (event.type === "typing") {
        setTypingUsers((prev) => updateTypingUsers(prev, event, currentUserId, Date.now()));
        return;
      }

      if (
        event.type === "voice.presence.joined" ||
        event.type === "voice.presence.left" ||
        event.type === "voice.presence.snapshot"
      ) {
        setVoicePresence((prev) => updateVoicePresence(prev, event));
        return;
      }

      if (event.type !== "message" || event.room_id === ZERO_UUID) return;
      handleMessageEvent(event);
    },
    [currentUserId, handleMessageEvent, handleRoomEvent],
  );

  const { status, subscribeRoom, unsubscribeRoom, sendMessage, sendTyping } = useSocket({
    enabled: authed === true,
    onEvent: handleEvent,
    onProtocolError: setBanner,
    onSessionExpired: () => {
      endSession();
      setBanner("Sessão encerrada no servidor. Entre novamente.");
    },
  });

  useEffect(() => {
    const roomIds = rooms.filter((room) => room.type === "voice").map((room) => room.id);

    for (const roomId of roomIds) subscribeRoom(roomId);

    return () => {
      for (const roomId of roomIds) unsubscribeRoom(roomId);
    };
  }, [rooms, subscribeRoom, unsubscribeRoom]);

  useEffect(() => {
    if (status !== "connecting") return;
    setVoicePresence({});
  }, [status]);

  const setTyping = useCallback(
    (typing: boolean) => {
      const roomId = activeRoomRef.current?.id;

      if (!typing) {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
        if (typingRoomRef.current) sendTyping(typingRoomRef.current, "stop");
        typingRoomRef.current = null;
        return;
      }

      if (!roomId || typingTimerRef.current) return;

      sendTyping(roomId, "start");
      typingRoomRef.current = roomId;
      typingTimerRef.current = setTimeout(() => {
        typingTimerRef.current = null;
      }, TYPING_EVENT_INTERVAL_MS);
    },
    [sendTyping],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers((prev) => expireTypingUsers(prev, Date.now(), TYPING_EXPIRATION_MS));
    }, TYPING_EVENT_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    },
    [],
  );

  const openRoom = useCallback(
    async (room: Room) => {
      if (room.type !== "text") return;
      if (room.id === activeRoomRef.current?.id) return;

      setTyping(false);
      setActiveRoom(room);
      writeActiveRoomId(typeof localStorage === "undefined" ? null : localStorage, room.id);
      setUnread((prev) => clearUnread(prev, room.id));
      subscribeRoom(room.id);

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
    [messages, setTyping, subscribeRoom],
  );

  useEffect(() => {
    if (selectedInitialRoomRef.current || activeRoom || rooms.length === 0) return;

    const storage = typeof localStorage === "undefined" ? null : localStorage;
    const persistedId = readActiveRoomId(storage);
    const target = persistedId
      ? rooms.find((room) => room.id === persistedId && room.type === "text")
      : undefined;

    const room = target ?? firstTextRoom(rooms);

    if (room) {
      selectedInitialRoomRef.current = true;
      void openRoom(room);
    }
  }, [rooms, activeRoom, openRoom]);

  const createRoom = useCallback(
    async (name: string, type: "text" | "voice") => {
      const room = await createRoomApi(name, type);

      setRooms((prev) => upsertRoom(prev, room));
      queryClient.setQueryData<Room[]>(["rooms"], (prev) => upsertRoom(prev ?? [], room));

      if (room.type === "text") {
        void openRoom(room);
      }
    },
    [openRoom, queryClient],
  );

  const updateRoom = useCallback(
    async (roomId: string, name: string) => {
      const room = await updateRoomApi(roomId, name);
      setRooms((prev) => upsertRoom(prev, room));
      queryClient.setQueryData<Room[]>(["rooms"], (prev) => upsertRoom(prev ?? [], room));
      setActiveRoom((current) => (current?.id === room.id ? room : current));
    },
    [queryClient],
  );

  const deleteRoom = useCallback(
    async (roomId: string) => {
      await deleteRoomApi(roomId);
      removeRoomLocally(roomId);
      queryClient.setQueryData<Room[]>(["rooms"], (prev) =>
        prev?.filter((room) => room.id !== roomId),
      );
    },
    [queryClient, removeRoomLocally],
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
      selectedInitialRoomRef.current = false;
      void loadSession();
    },
    [setUsername, loadSession],
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

  const updateEmail = useCallback(
    async (next: string) => {
      const updated = await updateEmailApi(next);
      setEmail(updated.email);
      queryClient.setQueryData<CurrentUser>(["me"], (prev) => {
        if (!prev) return prev;
        return { ...prev, email: updated.email };
      });
      return updated.email;
    },
    [queryClient],
  );

  const toggleNotifications = useCallback(async () => {
    if (typeof Notification === "undefined") return;

    const next = !notificationsEnabledRef.current;

    if (!next) {
      writeNotificationsEnabled(typeof localStorage === "undefined" ? null : localStorage, false);
      setNotificationsEnabled(false);
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (!notificationPermissionGranted()) {
      setBanner(
        "Notificações bloqueadas no navegador. Libere nas configurações do navegador e tente de novo.",
      );
      return;
    }

    writeNotificationsEnabled(typeof localStorage === "undefined" ? null : localStorage, true);
    setNotificationsEnabled(true);
  }, []);

  const toggleSound = useCallback(async () => {
    const next = !soundEnabledRef.current;
    writeSoundEnabled(typeof localStorage === "undefined" ? null : localStorage, next);
    setSoundEnabled(next);
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
    email,
    currentUserId,
    authed,
    rooms,
    canManageRooms: canManageRooms(role),
    canModerateMessages: canModerateMessages(role),
    activeRoom,
    messages,
    banner,
    loadingHistory,
    unread,
    typingUsers,
    voicePresence,
    socketStatus: status,
    openRoom,
    createRoom,
    updateRoom,
    deleteRoom,
    deleteMessage,
    logout,
    authenticate,
    dismissBanner,
    showBanner,
    updateEmail,
    notificationsEnabled,
    toggleNotifications,
    soundEnabled,
    toggleSound,
    sendMessage,
    setTyping,
  };
}
