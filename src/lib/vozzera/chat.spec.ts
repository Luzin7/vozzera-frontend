import { describe, expect, it } from "vitest";

import {
  appendMessage,
  backoffDelay,
  firstTextRoom,
  nextRoomIndex,
  parseFrame,
  removeRoom,
  upsertRoom,
} from "@/lib/vozzera/chat";
import type { ChatMessage, Room } from "@/lib/vozzera/types";
import { MAX_FRAME_BYTES } from "@/lib/vozzera/ws-schema";

function message(id: string, roomId = "r1"): ChatMessage {
  return {
    id,
    roomId,
    userId: "u1",
    username: "luan",
    content: "oi",
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "",
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

describe("nextRoomIndex", () => {
  it("moves down and wraps to the first", () => {
    expect(nextRoomIndex("ArrowDown", 0, 3)).toBe(1);
    expect(nextRoomIndex("ArrowDown", 2, 3)).toBe(0);
  });

  it("moves up and wraps to the last", () => {
    expect(nextRoomIndex("ArrowUp", 2, 3)).toBe(1);
    expect(nextRoomIndex("ArrowUp", 0, 3)).toBe(2);
  });

  it("returns null for other keys", () => {
    expect(nextRoomIndex("Enter", 0, 3)).toBeNull();
  });
});

describe("room state", () => {
  const room: Room = { id: "r1", name: "geral", type: "text", created_at: "" };

  it("adds and updates a room without duplicating it", () => {
    expect(upsertRoom([], room)).toEqual([room]);
    expect(upsertRoom([room], { ...room, name: "bate-papo" })).toEqual([
      { ...room, name: "bate-papo" },
    ]);
  });

  it("removes the state owned by a deleted room", () => {
    expect(removeRoom({ r1: [message("a")], r2: [message("b", "r2")] }, "r1")).toEqual({
      r2: [message("b", "r2")],
    });
  });
});

describe("parseFrame", () => {
  it("parses a valid json frame", () => {
    const raw = {
      data: '{"type":"message","action":"created","id":"m1","room_id":"r1","user_id":"u1","username":"luan","content":"oi","created_at":"2026-08-13T00:00:00Z"}',
    } as MessageEvent;
    expect(parseFrame(raw)?.type).toBe("message");
  });

  it("parses an updated frame without username and created_at", () => {
    const raw = {
      data: '{"type":"message","action":"updated","id":"m1","room_id":"r1","user_id":"u1","content":"oi editado","updated_at":"2026-08-13T00:00:00Z"}',
    } as MessageEvent;
    const event = parseFrame(raw);
    expect(event).not.toBeNull();
    expect(event).toMatchObject({ action: "updated", content: "oi editado" });
  });

  it("parses room lifecycle frames", () => {
    const updated = {
      data: '{"type":"room","action":"updated","id":"r1","name":"geral","room_type":"text"}',
    } as MessageEvent;
    const deleted = {
      data: '{"type":"room","action":"deleted","id":"r1"}',
    } as MessageEvent;

    expect(parseFrame(updated)).toMatchObject({ type: "room", action: "updated" });
    expect(parseFrame(deleted)).toMatchObject({ type: "room", action: "deleted" });
  });

  it("returns null for invalid json", () => {
    const raw = { data: "nope" } as MessageEvent;
    expect(parseFrame(raw)).toBeNull();
  });

  it("returns null for an unknown frame type", () => {
    const raw = { data: '{"type":"bogus"}' } as MessageEvent;
    expect(parseFrame(raw)).toBeNull();
  });

  it("returns null for a frame with wrong shape", () => {
    const raw = { data: '{"type":"message","id":42}' } as MessageEvent;
    expect(parseFrame(raw)).toBeNull();
  });

  it("returns null for a frame larger than the limit", () => {
    const raw = {
      data: `{"type":"error","error":"${"x".repeat(MAX_FRAME_BYTES)}"}`,
    } as MessageEvent;
    expect(parseFrame(raw)).toBeNull();
  });
});
