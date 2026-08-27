import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrl } from "@/lib/vozzera/api";
import { backoffDelay, parseFrame, WebSocketProtocolError } from "@/lib/vozzera/chat";
import type { InboundEvent, OutboundEvent } from "@/lib/vozzera/types";
import { inboundFrame } from "@/lib/vozzera/ws-schema";

export type SocketStatus = "connecting" | "open" | "closed";

type Options = {
  enabled: boolean;
  onEvent: (event: OutboundEvent) => void;
  onProtocolError?: (message: string) => void;
  onSessionExpired?: () => void;
};

export function useSocket({ enabled, onEvent, onProtocolError, onSessionExpired }: Options) {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const desiredRooms = useRef<Set<string>>(new Set());
  const queue = useRef<InboundEvent[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);
  const onEventRef = useRef(onEvent);
  const onProtocolErrorRef = useRef(onProtocolError);
  const onSessionExpiredRef = useRef(onSessionExpired);

  onEventRef.current = onEvent;
  onProtocolErrorRef.current = onProtocolError;
  onSessionExpiredRef.current = onSessionExpired;

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

    closedByUs.current = false;
    const desiredRoomIds = desiredRooms.current;

    const connect = () => {
      setStatus("connecting");

      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        attempt.current = 0;
        setStatus("open");

        for (const roomId of desiredRooms.current) {
          socket.send(JSON.stringify(inboundFrame("room.subscribe", roomId)));
        }

        const pending = queue.current;
        queue.current = [];

        for (const event of pending) {
          socket.send(JSON.stringify(event));
        }
      };

      socket.onmessage = (raw) => {
        try {
          onEventRef.current(parseFrame(raw));
        } catch (error) {
          if (error instanceof WebSocketProtocolError) {
            onProtocolErrorRef.current?.(error.message);
          }
        }
      };

      socket.onclose = (event) => {
        setStatus("closed");
        socketRef.current = null;

        if (closedByUs.current) return;

        if (event.code === 1005) {
          onSessionExpiredRef.current?.();
          return;
        }

        retryTimer.current = setTimeout(connect, backoffDelay(attempt.current));

        attempt.current += 1;
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closedByUs.current = true;

      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
      }

      socketRef.current?.close();
      socketRef.current = null;
      desiredRoomIds.clear();
      queue.current = [];
      setStatus("closed");
    };
  }, [enabled]);

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

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      rawSend(inboundFrame("message", roomId, content));
    },
    [rawSend],
  );

  const sendTyping = useCallback(
    (roomId: string, action: "start" | "stop") => {
      rawSend(inboundFrame(action === "start" ? "typing.start" : "typing.stop", roomId));
    },
    [rawSend],
  );

  return {
    status,
    subscribeRoom,
    unsubscribeRoom,
    sendMessage,
    sendTyping,
  };
}
