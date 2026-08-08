import { useCallback, useEffect, useRef, useState } from "react";

import { wsUrl } from "./api";
import type { InboundEvent, OutboundEvent } from "./types";

export type SocketStatus = "connecting" | "open" | "closed";

type Options = {
  enabled: boolean;
  onEvent: (event: OutboundEvent) => void;
};

/**
 * WebSocket com reconexão em backoff.
 * O servidor esquece as salas a cada conexão, então o hook reenvia
 * o `join` de todas as salas conhecidas no onopen.
 */
export function useSocket({ enabled, onEvent }: Options) {
  const [status, setStatus] = useState<SocketStatus>("closed");
  const socketRef = useRef<WebSocket | null>(null);
  const joinedRooms = useRef<Set<string>>(new Set());
  const queue = useRef<InboundEvent[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUs = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const rawSend = useCallback((event: InboundEvent) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    } else {
      queue.current.push(event);
    }
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
        // reenvia join de tudo que já estava aberto
        for (const roomId of joinedRooms.current) {
          socket.send(JSON.stringify({ type: "join", room_id: roomId }));
        }
        const pending = queue.current;
        queue.current = [];
        for (const event of pending) socket.send(JSON.stringify(event));
      };

      socket.onmessage = (raw) => {
        try {
          const event = JSON.parse(raw.data as string) as OutboundEvent;
          onEventRef.current(event);
        } catch {
          /* frame inválido: ignora */
        }
      };

      socket.onclose = () => {
        setStatus("closed");
        socketRef.current = null;
        if (closedByUs.current) return;
        const delay = Math.min(1000 * 2 ** attempt.current, 15000);
        attempt.current += 1;
        retryTimer.current = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      closedByUs.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("closed");
    };
  }, [enabled]);

  const joinRoom = useCallback(
    (roomId: string) => {
      if (joinedRooms.current.has(roomId)) return;
      joinedRooms.current.add(roomId);
      rawSend({ type: "join", room_id: roomId });
    },
    [rawSend],
  );

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      rawSend({ type: "message", room_id: roomId, content });
    },
    [rawSend],
  );

  return { status, joinRoom, sendMessage };
}
