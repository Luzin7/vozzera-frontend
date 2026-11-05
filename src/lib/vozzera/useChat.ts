import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  createRoom as createRoomApi,
  deleteMessage as deleteMessageApi,
  deleteRoom as deleteRoomApi,
  getCurrentUser,
  getPresence,
  isUnauthorized,
  listMessages,
  listRooms,
  logout as logoutApi,
  probeCurrentUser,
  setUnauthorizedHandler,
  updateEmail as updateEmailApi,
  updateRoom as updateRoomApi,
} from "@/lib/vozzera/api";
import {
  appendMessage,
  addOnlineUser,
  clearActiveRoomId,
  clearUnread,
  createTypingAnnouncer,
  expireTypingUsers,
  firstTextRoom,
  firstUnreadMessageId,
  incrementUnread,
  readActiveRoomId,
  removeOnlineUser,
  removeRoom,
  removeTypingUser,
  replaceOnlineUsers,
  totalUnread,
  TYPING_EXPIRY_TICK_MS,
  TYPING_RESEND_INTERVAL_MS,
  TYPING_START_DELAY_MS,
  updateTypingUsers,
  updateVoicePresence,
  upsertRoom,
  writeActiveRoomId,
} from "@/lib/vozzera/chat";
import { applyAwaySnapshot, createAwayConfirmation } from "@/lib/vozzera/away";
import type { AwayPresence } from "@/lib/vozzera/away";
import type { OnlineUsers, TypingUsers, VoicePresence } from "@/lib/vozzera/chat";
import {
  canNotify,
  initialNotificationsEnabled,
  notificationPermissionGranted,
  playMessageSound,
  readSoundEnabled,
  writeNotificationsEnabled,
  writeSoundEnabled,
} from "@/lib/vozzera/notifications";
import {
  diffRoomSubscriptions,
  HISTORY_REFETCH_DELAY_MS,
  createLiveEditTracker,
  historyFailureStatus,
  markHistoryStatus,
  markStaleRooms,
  mergeHistory,
  needsHistory,
  refetchHistoryStaggered,
  rememberRecentRoom,
  roomsToRefetch,
  shouldRefetchAfterStatus,
} from "@/lib/vozzera/chat-history";
import type { HistoryStatuses } from "@/lib/vozzera/chat-history";
import { createDraftStore } from "@/lib/vozzera/message-display";
import { canManageRooms, canModerateMessages, canSeeRoom } from "@/lib/vozzera/permissions";
import { isSessionRejected } from "@/lib/vozzera/session";
import type {
  AwayEndedReason,
  ChatMessage,
  CurrentUser,
  OutboundEvent,
  Room,
  UserRole,
} from "@/lib/vozzera/types";
import { fromEvent, fromHistory, ZERO_UUID } from "@/lib/vozzera/types";
import { useAuth } from "@/lib/vozzera/useAuth";
import { useSocket } from "@/lib/vozzera/useSocket";

const HISTORY_PAGE_SIZE = 50;

export type AwayEndedEventReason = AwayEndedReason | "snapshot_absent";

export type AwayEndedEvent = { roomId: string; userId: string; reason: AwayEndedEventReason };

type ChatOptions = { onAwayEnded?: (event: AwayEndedEvent) => void };

export function useChat(options?: ChatOptions) {
  const { username, setUsername, clearUsername } = useAuth();
  const queryClient = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState<HistoryStatuses>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [unreadMarker, setUnreadMarker] = useState<{
    roomId: string;
    messageId: string;
  } | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUsers>({});
  const [voicePresence, setVoicePresence] = useState<VoicePresence>({});
  const [awayPresence, setAwayPresence] = useState<AwayPresence>({});
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsers>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return initialNotificationsEnabled(localStorage);
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof localStorage === "undefined") return false;
    return readSoundEnabled(localStorage);
  });
  const awayPresenceRef = useRef(awayPresence);
  const voicePresenceRef = useRef(voicePresence);
  const awayConfirmationRef = useRef(createAwayConfirmation());
  const onAwayEndedRef = useRef(options?.onAwayEnded);
  const activeRoomRef = useRef(activeRoom);
  const roomsRef = useRef(rooms);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const selectedInitialRoomRef = useRef(false);
  const resubscribeRoomRef = useRef<((roomId: string) => void) | null>(null);
  const messagesRef = useRef(messages);
  const historyStatusRef = useRef(historyStatus);
  const subscribedRoomsRef = useRef(new Set<string>());
  const hasOpenedBeforeRef = useRef(false);
  const deletedMessageIdsRef = useRef(new Set<string>());
  const liveEditsRef = useRef(createLiveEditTracker());
  const recentRoomIdsRef = useRef<string[]>([]);
  const drafts = useMemo(() => createDraftStore(), []);

  onAwayEndedRef.current = options?.onAwayEnded;
  activeRoomRef.current = activeRoom;
  roomsRef.current = rooms;
  messagesRef.current = messages;
  historyStatusRef.current = historyStatus;
  notificationsEnabledRef.current = notificationsEnabled;
  soundEnabledRef.current = soundEnabled;

  const commitVoicePresence = useCallback((next: VoicePresence) => {
    voicePresenceRef.current = next;
    setVoicePresence(next);
  }, []);

  const commitAwayPresence = useCallback((next: AwayPresence) => {
    awayPresenceRef.current = next;
    setAwayPresence(next);
  }, []);

  const endSession = useCallback(() => {
    setBanner(null);
    clearUsername();
    setAuthed(false);
    setRooms([]);
    setRole(null);
    setEmail(null);
    setCurrentUserId(null);
    setActiveRoom(null);
    setMessages({});
    setHistoryStatus({});
    historyStatusRef.current = {};
    hasOpenedBeforeRef.current = false;
    deletedMessageIdsRef.current = new Set();
    liveEditsRef.current.clear();
    recentRoomIdsRef.current = [];
    drafts.clearAll();
    setUnread({});
    setUnreadMarker(null);
    setTypingUsers({});
    commitVoicePresence({});
    commitAwayPresence({});
    awayConfirmationRef.current.reset();
    setOnlineUsers({});
    selectedInitialRoomRef.current = false;
    clearActiveRoomId(typeof localStorage === "undefined" ? null : localStorage);
    queryClient.removeQueries({ queryKey: ["rooms"] });
    queryClient.removeQueries({ queryKey: ["me"] });
  }, [clearUsername, commitAwayPresence, commitVoicePresence, drafts, queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(endSession);

    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  const loadSession = useCallback(async () => {
    try {
      const [nextRooms, currentUser, presence] = await Promise.all([
        queryClient.ensureQueryData({
          queryKey: ["rooms"],
          queryFn: () => listRooms(),
          staleTime: 30_000,
        }),
        queryClient.ensureQueryData({
          queryKey: ["me"],
          queryFn: getCurrentUser,
          staleTime: 5 * 60_000,
        }),
        getPresence().catch(() => null),
      ]);
      setRooms(nextRooms);
      setUsername(currentUser.username);
      setRole(currentUser.role);
      setEmail(currentUser.email);
      setCurrentUserId(currentUser.id);
      setOnlineUsers((prev) => {
        if (!presence) {
          return addOnlineUser(prev, { userId: currentUser.id, username: currentUser.username });
        }

        const onlineList = (presence.online_users ?? []).map((u) => ({
          userId: u.user_id,
          username: u.username,
        }));
        const offlineList = (presence.offline_users ?? []).map((u) => ({
          userId: u.user_id,
          username: u.username,
        }));
        const next = replaceOnlineUsers(prev, onlineList);

        for (const user of offlineList) {
          if (!next[user.userId]) {
            next[user.userId] = { ...user, online: false };
          }
        }

        return next;
      });
      setAuthed(true);
    } catch (err) {
      if (isSessionRejected(err)) {
        setAuthed(false);
        return;
      }

      setAuthed(null);
      setSessionUnavailable(true);
    }
  }, [queryClient, setUsername]);

  const retrySession = useCallback(() => {
    setSessionUnavailable(false);
    void loadSession();
  }, [loadSession]);

  const isSessionAlive = useCallback(async () => {
    try {
      await probeCurrentUser();
      return true;
    } catch (err) {
      return !isUnauthorized(err);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const removeRoomLocally = useCallback(
    (roomId: string) => {
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      setMessages((prev) => removeRoom(prev, roomId));
      setHistoryStatus((prev) => removeRoom(prev, roomId));
      setUnread((prev) => removeRoom(prev, roomId));
      setTypingUsers((prev) => removeRoom(prev, roomId));
      commitVoicePresence(removeRoom(voicePresenceRef.current, roomId));
      commitAwayPresence(removeRoom(awayPresenceRef.current, roomId));
      setActiveRoom((current) => (current?.id === roomId ? null : current));
      setUnreadMarker((current) => (current?.roomId === roomId ? null : current));
    },
    [commitAwayPresence, commitVoicePresence],
  );

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
        created_by: current?.created_by ?? null,
        has_voice: event.has_voice,
        staff_only: event.staff_only,
        created_at: event.created_at,
        updated_at: current?.updated_at ?? null,
      };

      if (!canSeeRoom(room, role)) {
        removeRoomLocally(room.id);
        queryClient.setQueryData<Room[]>(["rooms"], (prev) =>
          prev?.filter((item) => item.id !== room.id),
        );
        return;
      }

      setRooms((prev) => upsertRoom(prev, room));
      queryClient.setQueryData<Room[]>(["rooms"], (prev) => upsertRoom(prev ?? [], room));
      setActiveRoom((active) => (active?.id === room.id ? { ...active, ...room } : active));

      if (event.staff_only) resubscribeRoomRef.current?.(room.id);
    },
    [queryClient, removeRoomLocally, role],
  );

  const handleMessageEvent = useCallback(
    (event: Extract<OutboundEvent, { type: "message" }>) => {
      if (event.action === "deleted") {
        deletedMessageIdsRef.current.add(event.id);
        setMessages((prev) => ({
          ...prev,
          [event.room_id]: (prev[event.room_id] ?? []).filter((message) => message.id !== event.id),
        }));
        return;
      }

      if (event.action === "created") {
        setMessages((prev) => appendMessage(prev, fromEvent(event)));
        setTypingUsers((prev) => removeTypingUser(prev, event.room_id, event.user_id));

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

        if (event.room_id === activeRoomRef.current?.id && event.user_id === currentUserId) {
          setUnreadMarker(null);
        }

        return;
      }

      if (event.action === "updated") {
        liveEditsRef.current.markEdited(event.id);
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
    },
    [currentUserId],
  );

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
        commitVoicePresence(updateVoicePresence(voicePresenceRef.current, event));
        return;
      }

      if (event.type === "voice.away.snapshot") {
        commitAwayPresence(applyAwaySnapshot(awayPresenceRef.current, event.room_id, event.away));
        if (
          currentUserId !== null &&
          awayConfirmationRef.current.observe(event.room_id, event.away, currentUserId)
        ) {
          onAwayEndedRef.current?.({
            roomId: event.room_id,
            userId: currentUserId,
            reason: "snapshot_absent",
          });
        }
        return;
      }

      if (event.type === "voice.away.resync") {
        awayConfirmationRef.current.reset();
        return;
      }

      if (event.type === "voice.away.ended") {
        onAwayEndedRef.current?.({
          roomId: event.room_id,
          userId: event.user_id,
          reason: event.reason,
        });
        return;
      }

      if (event.type === "user.online") {
        setOnlineUsers((prev) =>
          addOnlineUser(prev, { userId: event.userId, username: event.username }),
        );
        return;
      }

      if (event.type === "user.offline") {
        setOnlineUsers((prev) => removeOnlineUser(prev, event.userId, event.username));
        return;
      }

      if (event.type === "presence.snapshot") {
        setOnlineUsers((prev) => replaceOnlineUsers(prev, event.online_users));
        return;
      }

      if (event.type !== "message" || event.room_id === ZERO_UUID) return;
      handleMessageEvent(event);
    },
    [commitAwayPresence, commitVoicePresence, currentUserId, handleMessageEvent, handleRoomEvent],
  );

  const {
    status,
    subscribeRoom,
    unsubscribeRoom,
    resubscribeRoom,
    sendMessage,
    sendTyping,
    setAwayIntent,
    dropAwayIntent,
    resendAwayIntent,
  } = useSocket({
    enabled: authed === true,
    onEvent: handleEvent,
    onProtocolError: setBanner,
    onSessionExpired: () => {
      endSession();
      setBanner("Sessão encerrada no servidor. Entre novamente.");
    },
    isSessionAlive,
  });

  resubscribeRoomRef.current = resubscribeRoom;

  useEffect(() => {
    const { toSubscribe, toUnsubscribe } = diffRoomSubscriptions(
      subscribedRoomsRef.current,
      rooms.map((room) => room.id),
    );

    for (const roomId of toSubscribe) subscribeRoom(roomId);
    for (const roomId of toUnsubscribe) unsubscribeRoom(roomId);
    subscribedRoomsRef.current = new Set(toSubscribe);
  }, [rooms, subscribeRoom, unsubscribeRoom]);

  useEffect(() => {
    if (status !== "connecting") return;
    awayConfirmationRef.current.reset();
  }, [status]);

  const typingAnnouncer = useMemo(
    () =>
      createTypingAnnouncer({
        send: sendTyping,
        startDelayMs: TYPING_START_DELAY_MS,
        resendIntervalMs: TYPING_RESEND_INTERVAL_MS,
      }),
    [sendTyping],
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      const roomId = activeRoomRef.current?.id;

      if (!typing || !roomId) {
        typingAnnouncer.stop();
        return;
      }

      typingAnnouncer.typing(roomId);
    },
    [typingAnnouncer],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTypingUsers((prev) => expireTypingUsers(prev, Date.now()));
    }, TYPING_EXPIRY_TICK_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => typingAnnouncer.stop(), [typingAnnouncer]);

  const loadHistory = useCallback(async (roomId: string) => {
    const knownBeforeFetch = new Set((messagesRef.current[roomId] ?? []).map((m) => m.id));
    const editCheckpoint = liveEditsRef.current.checkpoint();
    const history = await listMessages(roomId, HISTORY_PAGE_SIZE);
    const fetched = history.map((message) => fromHistory(message, roomId));
    const options = {
      deletedIds: deletedMessageIdsRef.current,
      editedDuringFetchIds: liveEditsRef.current.editedSince(editCheckpoint),
      knownBeforeFetch,
      pageSize: HISTORY_PAGE_SIZE,
    };

    setMessages((prev) => ({
      ...prev,
      [roomId]: mergeHistory(prev[roomId] ?? [], fetched, options),
    }));

    return mergeHistory(messagesRef.current[roomId] ?? [], fetched, options);
  }, []);

  const loadRoomHistory = useCallback(
    async (roomId: string, unreadCount: number) => {
      setHistoryStatus((prev) => markHistoryStatus(prev, roomId, "loading"));
      historyStatusRef.current = markHistoryStatus(historyStatusRef.current, roomId, "loading");
      setLoadingHistory(true);

      try {
        const merged = await loadHistory(roomId);
        setHistoryStatus((prev) => markHistoryStatus(prev, roomId, "loaded"));
        historyStatusRef.current = markHistoryStatus(historyStatusRef.current, roomId, "loaded");

        const markerId = firstUnreadMessageId(merged, unreadCount);
        if (activeRoomRef.current?.id === roomId && markerId) {
          setUnreadMarker({ roomId, messageId: markerId });
        }
      } catch (err) {
        setHistoryStatus((prev) => markHistoryStatus(prev, roomId, "failed"));
        historyStatusRef.current = markHistoryStatus(historyStatusRef.current, roomId, "failed");

        if (isUnauthorized(err)) {
          setAuthed(false);
          return;
        }

        setBanner("Não consegui carregar o histórico.");
      } finally {
        setLoadingHistory(false);
      }
    },
    [loadHistory],
  );

  const openRoom = useCallback(
    async (room: Room) => {
      if (room.id === activeRoomRef.current?.id) return;

      setTyping(false);
      setActiveRoom(room);
      activeRoomRef.current = room;
      if (!room.has_voice) {
        writeActiveRoomId(typeof localStorage === "undefined" ? null : localStorage, room.id);
      }
      const unreadCount = unread[room.id] ?? 0;
      const cachedMessages = messages[room.id];
      const cachedMarkerId = cachedMessages
        ? firstUnreadMessageId(cachedMessages, unreadCount)
        : null;
      setUnreadMarker(cachedMarkerId ? { roomId: room.id, messageId: cachedMarkerId } : null);
      setUnread((prev) => clearUnread(prev, room.id));
      subscribeRoom(room.id);
      recentRoomIdsRef.current = rememberRecentRoom(recentRoomIdsRef.current, room.id);

      if (!needsHistory(historyStatusRef.current, room.id)) return;

      await loadRoomHistory(room.id, unreadCount);
    },
    [loadRoomHistory, messages, setTyping, subscribeRoom, unread],
  );

  const retryHistory = useCallback(
    async (roomId: string) => {
      if (!needsHistory(historyStatusRef.current, roomId)) return;
      await loadRoomHistory(roomId, 0);
    },
    [loadRoomHistory],
  );

  useEffect(() => {
    if (status === "closed" || status === "connecting") return;

    const shouldRefetch = shouldRefetchAfterStatus({
      hasOpenedBefore: hasOpenedBeforeRef.current,
      status,
    });
    hasOpenedBeforeRef.current = true;
    if (!shouldRefetch) return;

    let cancelled = false;
    const roomIds = roomsToRefetch(
      historyStatusRef.current,
      roomsRef.current.map((room) => room.id),
      {
        activeRoomId: activeRoomRef.current?.id ?? null,
        recentRoomIds: recentRoomIdsRef.current,
      },
    );

    const staleStatuses = markStaleRooms(historyStatusRef.current, roomIds);
    historyStatusRef.current = staleStatuses;
    setHistoryStatus(staleStatuses);

    void refetchHistoryStaggered({
      roomIds,
      fetchRoom: async (roomId) => {
        await loadHistory(roomId);
      },
      onError: (roomId, error) => {
        console.error(`Falha ao atualizar o histórico da sala ${roomId}:`, error);
        const failureStatus = historyFailureStatus(roomId, activeRoomRef.current?.id ?? null);
        setHistoryStatus((prev) => markHistoryStatus(prev, roomId, failureStatus));
        historyStatusRef.current = markHistoryStatus(
          historyStatusRef.current,
          roomId,
          failureStatus,
        );
      },
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      delayMs: HISTORY_REFETCH_DELAY_MS,
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
    };
  }, [status, loadHistory]);

  const dismissUnreadMarker = useCallback((roomId: string) => {
    setUnreadMarker((current) => (current?.roomId === roomId ? null : current));
  }, []);

  useEffect(() => {
    if (selectedInitialRoomRef.current || activeRoom || rooms.length === 0) return;

    const storage = typeof localStorage === "undefined" ? null : localStorage;
    const persistedId = readActiveRoomId(storage);
    const target = persistedId
      ? rooms.find((room) => room.id === persistedId && !room.has_voice)
      : undefined;

    const room = target ?? firstTextRoom(rooms);

    if (room) {
      selectedInitialRoomRef.current = true;
      void openRoom(room);
    }
  }, [rooms, activeRoom, openRoom]);

  const applyRoomUpdate = useCallback(
    (room: Room) => {
      setRooms((prev) => upsertRoom(prev, room));
      queryClient.setQueryData<Room[]>(["rooms"], (prev) => upsertRoom(prev ?? [], room));
      setActiveRoom((current) => (current?.id === room.id ? { ...current, ...room } : current));
    },
    [queryClient],
  );

  const createRoom = useCallback(
    async (input: { name: string; hasVoice: boolean; staffOnly: boolean }) => {
      const room = await createRoomApi(input);

      applyRoomUpdate(room);

      if (!room.has_voice) void openRoom(room);
    },
    [applyRoomUpdate, openRoom],
  );

  const updateRoom = useCallback(
    async (roomId: string, input: { name: string; staffOnly?: boolean }) => {
      applyRoomUpdate(await updateRoomApi(roomId, input));
    },
    [applyRoomUpdate],
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

  const deleteMessage = useCallback(async ({ id, roomId }: ChatMessage) => {
    try {
      await deleteMessageApi(roomId, id);
      deletedMessageIdsRef.current.add(id);

      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).filter((message) => message.id !== id),
      }));
    } catch (err) {
      if (isUnauthorized(err)) {
        setAuthed(false);
        return;
      }

      setBanner("Não consegui excluir a mensagem.");
    }
  }, []);

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
    onlineUsers,
    authed,
    sessionUnavailable,
    retrySession,
    rooms,
    canManageRooms: canManageRooms(role),
    canModerateMessages: canModerateMessages(role),
    activeRoom,
    messages,
    banner,
    loadingHistory,
    historyStatus,
    retryHistory,
    drafts,
    unread,
    unreadMarker,
    typingUsers,
    voicePresence,
    awayPresence,
    awayPresenceRef,
    voicePresenceRef,
    setAwayIntent,
    dropAwayIntent,
    resendAwayIntent,
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
    dismissUnreadMarker,
  };
}
