import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrl } from "./api";
import { backoffDelay, parseFrame } from "./chat";
import type { InboundEvent, OutboundEvent } from "./types";

export type SocketStatus = "connecting" | "open" | "closed";

type Options = {
  enabled: boolean;
  onEvent: (event: OutboundEvent) => void;
  onSessionExpired?: () => void;
};

export function useSocket({ enabled, onEvent, onSessionExpired }: Options) {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());
  const queue = useRef<InboundEvent[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);
  const onEventRef = useRef(onEvent);
  const onSessionExpiredRef = useRef(onSessionExpired);

  onEventRef.current = onEvent;
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

    const connect = () => {
      setStatus("connecting");

      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        attempt.current = 0;
        setStatus("open");

        for (const roomId of joinedRooms.current) {
          socket.send(
            JSON.stringify({
              type: "join",
              room_id: roomId,
            }),
          );
        }

        const pending = queue.current;
        queue.current = [];

        for (const event of pending) {
          socket.send(JSON.stringify(event));
        }
      };

      socket.onmessage = (raw) => {
        const event = parseFrame(raw);

        if (event) {
          onEventRef.current(event);
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
      setStatus("closed");
    };
  }, [enabled]);

  const joinRoom = useCallback(
    (roomId: string) => {
      if (joinedRooms.current.has(roomId)) return;

      joinedRooms.current.add(roomId);

      rawSend({
        type: "join",
        room_id: roomId,
      });
    },
    [rawSend],
  );

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      rawSend({
        type: "message",
        room_id: roomId,
        content,
      });
    },
    [rawSend],
  );

  return {
    status,
    joinRoom,
    sendMessage,
  };
}
