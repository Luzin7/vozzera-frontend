// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSocket } from "@/lib/vozzera/useSocket";

const ROOM_ID = "00000000-0000-4000-8000-000000000001";
const LEAVE = { roomId: ROOM_ID, sid: "PA_local" };

class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;

  constructor() {
    FakeSocket.instances.push(this);
  }

  static opened(): FakeSocket {
    const [socket] = FakeSocket.instances;
    if (!socket) throw new Error("useSocket did not open a socket");
    return socket;
  }

  send(frame: string) {
    this.sent.push(frame);
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
  }
}

function openSocket(socket: FakeSocket) {
  socket.readyState = FakeSocket.OPEN;
  socket.onopen?.();
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", FakeSocket);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  FakeSocket.instances.length = 0;
});

describe("useSocket sendVoiceLeave", () => {
  it("sends voice.leave with the room id and participant sid while the socket is open", () => {
    const { result } = renderHook(() => useSocket({ enabled: true, onEvent: vi.fn() }));
    const socket = FakeSocket.opened();
    openSocket(socket);

    result.current.sendVoiceLeave(LEAVE);

    expect(socket.sent.map((frame) => JSON.parse(frame))).toEqual([
      {
        v: 1,
        type: "voice.leave",
        topic: `room:${ROOM_ID}`,
        ts: expect.any(String),
        data: { room_id: ROOM_ID, sid: "PA_local" },
      },
    ]);
  });

  it("drops voice.leave while the socket is closed instead of queueing it", () => {
    const { result } = renderHook(() => useSocket({ enabled: true, onEvent: vi.fn() }));
    const socket = FakeSocket.opened();
    socket.readyState = FakeSocket.CLOSED;

    result.current.sendVoiceLeave(LEAVE);
    openSocket(socket);

    expect(socket.sent).toEqual([]);
  });

  it("does nothing without a socket", () => {
    const { result } = renderHook(() => useSocket({ enabled: false, onEvent: vi.fn() }));

    expect(() => result.current.sendVoiceLeave(LEAVE)).not.toThrow();
    expect(FakeSocket.instances).toEqual([]);
  });
});
