import { describe, expect, it } from "vitest";

import { appendMessage, backoffDelay, firstTextRoom, parseFrame } from "./chat";
import type { ChatMessage, Room } from "./types";

function message(id: string, roomId = "r1"): ChatMessage {
  return {
    id,
    roomId,
    userId: "u1",
    username: "luan",
    content: "oi",
    createdAt: "2026-08-13T00:00:00Z",
  };
}

describe("appendMessage", () => {
  it("adds a new message to the room list", () => {
    expect(appendMessage({}, message("a"))).toEqual({ r1: [message("a")] });
  });

  it("keeps earlier messages intact", () => {
    const state = { r1: [message("a")] };
    expect(appendMessage(state, message("b"))).toEqual({ r1: [message("a"), message("b")] });
  });

  it("deduplicates by id without mutating", () => {
    const state = { r1: [message("a")] };
    expect(appendMessage(state, message("a"))).toBe(state);
  });
});

describe("backoffDelay", () => {
  it("grows exponentially", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
  });

  it("caps at 15 seconds", () => {
    expect(backoffDelay(10)).toBe(15000);
  });
});

describe("firstTextRoom", () => {
  const rooms: Room[] = [
    { id: "v1", name: "voz", type: "voice", created_at: "" },
    { id: "t1", name: "geral", type: "text", created_at: "" },
  ];

  it("returns the first text room", () => {
    expect(firstTextRoom(rooms)?.id).toBe("t1");
  });

  it("returns undefined when there is no text room", () => {
    expect(firstTextRoom(rooms.filter((room) => room.type === "voice"))).toBeUndefined();
  });
});

describe("parseFrame", () => {
  it("parses a valid json frame", () => {
    const raw = { data: '{"type":"message","id":"m1"}' } as MessageEvent;
    expect(parseFrame(raw)?.type).toBe("message");
  });

  it("returns null for invalid json", () => {
    const raw = { data: "nope" } as MessageEvent;
    expect(parseFrame(raw)).toBeNull();
  });
});
