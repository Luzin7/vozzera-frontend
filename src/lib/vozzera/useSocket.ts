import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrl } from "@/lib/vozzera/api";
import {
  backoffDelay,
  createSocketHeartbeat,
  isPongFrame,
  isSessionRevokedClose,
  parseFrame,
  sendPingFrame,
  SOCKET_FRAME_WATCHDOG_MS,
  SOCKET_PING_INTERVAL_MS,
  WebSocketProtocolError,
} from "@/lib/vozzera/chat";
import type { SocketHeartbeat, TypingAction } from "@/lib/vozzera/chat";
import { createAwayIntentTracker } from "@/lib/vozzera/away-intent";
import type { AwayCommand, AwayIntent } from "@/lib/vozzera/away-intent";
import type { InboundEvent, OutboundEvent } from "@/lib/vozzera/types";
import { awayFrame, inboundFrame } from "@/lib/vozzera/ws-schema";

export type SocketStatus = "connecting" | "open" | "closed";

type Options = {
  enabled: boolean;
  onEvent: (event: OutboundEvent) => void;
  onProtocolError?: (message: string) => void;
  onSessionExpired?: () => void;
  isSessionAlive?: () => Promise<boolean>;
};

export function useSocket({
  enabled,
  onEvent,
  onProtocolError,
  onSessionExpired,
  isSessionAlive,
}: Options) {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const desiredRooms = useRef<Set<string>>(new Set());
  const awayTracker = useRef(createAwayIntentTracker());
  const queue = useRef<InboundEvent[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<SocketHeartbeat | null>(null);
  const onEventRef = useRef(onEvent);
  const onProtocolErrorRef = useRef(onProtocolError);
  const onSessionExpiredRef = useRef(onSessionExpired);
  const isSessionAliveRef = useRef(isSessionAlive);

  onEventRef.current = onEvent;
  onProtocolErrorRef.current = onProtocolError;
  onSessionExpiredRef.current = onSessionExpired;
  isSessionAliveRef.current = isSessionAlive;

  const sendAwayCommands = useCallback((socket: WebSocket, commands: AwayCommand[]) => {
    for (const command of commands) socket.send(JSON.stringify(awayFrame(command)));
  }, []);

  const rawSend = useCallback((event: InboundEvent) => {
    const socket = socketRef.current;

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
      return;
    }

    queue.current.push(event);
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let disposed = false;
    const desiredRoomIds = desiredRooms.current;

    const connect = () => {
      setStatus("connecting");

      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        attempt.current = 0;
        setStatus("open");

        const heartbeat = createSocketHeartbeat({
          timeoutMs: SOCKET_FRAME_WATCHDOG_MS,
          intervalMs: SOCKET_PING_INTERVAL_MS,
          sendPing: () => sendPingFrame(socket),
          onTimeout: () => socket.close(),
        });
        heartbeatRef.current = heartbeat;
        heartbeat.open();

        for (const roomId of desiredRooms.current) {
          socket.send(JSON.stringify(inboundFrame("room.subscribe", roomId)));
        }

        sendAwayCommands(socket, awayTracker.current.onOpen());

        const pending = queue.current;
        queue.current = [];

        for (const event of pending) {
          socket.send(JSON.stringify(event));
        }
      };

      socket.onmessage = (raw) => {
        heartbeatRef.current?.frame();

        if (isPongFrame(raw)) return;

        try {
          const event = parseFrame(raw);
          if (!event) return;
          if (event.type === "voice.away.resync") {
            sendAwayCommands(socket, awayTracker.current.onResync());
          }
          onEventRef.current(event);
        } catch (error) {
          if (error instanceof WebSocketProtocolError) {
            onProtocolErrorRef.current?.(error.message);
          }
        }
      };

      socket.onclose = (event) => {
        heartbeatRef.current?.close();
        heartbeatRef.current = null;
        setStatus("closed");
        socketRef.current = null;

        if (disposed) return;

        if (isSessionRevokedClose(event.code)) {
          onSessionExpiredRef.current?.();
          return;
        }

        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          void reconnect();
        }, backoffDelay(attempt.current));

        attempt.current += 1;
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    const reconnect = async () => {
      const alive = (await isSessionAliveRef.current?.()) ?? true;
      if (disposed) return;

      if (!alive) {
        onSessionExpiredRef.current?.();
        return;
      }

      connect();
    };

    const reconnectNow = () => {
      if (!retryTimer.current) return;
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
      void reconnect();
    };

    const reconnectWhenVisible = () => {
      if (document.visibilityState === "visible") reconnectNow();
    };

    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", reconnectWhenVisible);

    connect();

    return () => {
      disposed = true;
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", reconnectWhenVisible);

      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }
      retryTimer.current = null;

      heartbeatRef.current?.close();
      heartbeatRef.current = null;
      socketRef.current?.close();
      socketRef.current = null;
      desiredRoomIds.clear();
      queue.current = [];
      awayTracker.current = createAwayIntentTracker();
      setStatus("closed");
    };
  }, [enabled, sendAwayCommands]);

  const subscribeRoom = useCallback((roomId: string) => {
    if (desiredRooms.current.has(roomId)) return;

    desiredRooms.current.add(roomId);

    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(inboundFrame("room.subscribe", roomId)));
  }, []);

  const unsubscribeRoom = useCallback((roomId: string) => {
    desiredRooms.current.delete(roomId);

    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(inboundFrame("room.unsubscribe", roomId)));
  }, []);

  const resubscribeRoom = useCallback(
    (roomId: string) => {
      desiredRooms.current.delete(roomId);
      subscribeRoom(roomId);
    },
    [subscribeRoom],
  );

  const sendMessage = useCallback(
    (roomId: string, content: string, replyToMessageId?: string) => {
      rawSend(inboundFrame("message", roomId, content, replyToMessageId));
    },
    [rawSend],
  );

  const sendTyping = useCallback((roomId: string, action: TypingAction) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify(inboundFrame(action === "start" ? "typing.start" : "typing.stop", roomId)),
    );
  }, []);

  const setAwayIntent = useCallback(
    (intent: AwayIntent | null) => {
      const socket = socketRef.current;
      const open = socket?.readyState === WebSocket.OPEN;
      const commands = awayTracker.current.set(intent, open);
      if (open) sendAwayCommands(socket, commands);
    },
    [sendAwayCommands],
  );

  const resendAwayIntent = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    sendAwayCommands(socket, awayTracker.current.onResync());
  }, [sendAwayCommands]);

  const dropAwayIntent = useCallback(() => awayTracker.current.drop(), []);

  return {
    status,
    setAwayIntent,
    dropAwayIntent,
    resendAwayIntent,
    subscribeRoom,
    unsubscribeRoom,
    resubscribeRoom,
    sendMessage,
    sendTyping,
  };
}
