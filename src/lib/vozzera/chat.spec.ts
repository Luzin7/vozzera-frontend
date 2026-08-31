import { describe, expect, it } from "vitest";

import {
  ACTIVE_ROOM_STORAGE_KEY,
  appendMessage,
  backoffDelay,
  clearActiveRoomId,
  dateGroupLabelFor,
  expireTypingUsers,
  firstTextRoom,
  nextRoomIndex,
  parseFrame,
  readActiveRoomId,
  removeRoom,
  sortRooms,
  typingIndicatorText,
  updateTypingUsers,
  updateVoicePresence,
  upsertRoom,
  writeActiveRoomId,
} from "@/lib/vozzera/chat";
import type { ChatMessage, Room } from "@/lib/vozzera/types";
import { MAX_FRAME_BYTES } from "@/lib/vozzera/ws-schema";
import type { ActiveRoomStorage } from "@/lib/vozzera/chat";

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

describe("sortRooms", () => {
  it("orders rooms alphabetically without case sensitivity", () => {
    const rooms: Room[] = [
      { id: "1", name: "Zebra", type: "text", created_at: "" },
      { id: "2", name: "alpha", type: "voice", created_at: "" },
      { id: "3", name: "Árvore", type: "text", created_at: "" },
    ];

    expect(sortRooms(rooms).map((room) => room.name)).toEqual(["alpha", "Árvore", "Zebra"]);
  });

  it("keeps the original room list unchanged", () => {
    const rooms: Room[] = [
      { id: "1", name: "Zebra", type: "text", created_at: "" },
      { id: "2", name: "Alpha", type: "voice", created_at: "" },
    ];

    sortRooms(rooms);

    expect(rooms.map((room) => room.name)).toEqual(["Zebra", "Alpha"]);
  });
});

describe("dateGroupLabelFor", () => {
  const now = new Date(2026, 7, 21, 12);

  it("labels messages from today", () => {
    expect(dateGroupLabelFor(new Date(2026, 7, 21, 8).toISOString(), now)).toBe("Hoje");
  });

  it("labels messages from yesterday", () => {
    expect(dateGroupLabelFor(new Date(2026, 7, 20, 23).toISOString(), now)).toBe("Ontem");
  });

  it("formats older dates in pt-BR", () => {
    expect(dateGroupLabelFor(new Date(2026, 6, 15, 10).toISOString(), now)).toBe(
      "15 de julho de 2026",
    );
  });

  it("returns an empty label for an invalid timestamp", () => {
    expect(dateGroupLabelFor("invalid", now)).toBe("");
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

  it("keeps rooms ordered after an insertion or rename", () => {
    const alpha = { ...room, id: "r2", name: "alpha" };
    const zebra = { ...room, id: "r3", name: "zebra" };

    expect(upsertRoom([zebra], alpha)).toEqual([alpha, zebra]);
    expect(upsertRoom([alpha, zebra], { ...zebra, name: "beta" })).toEqual([
      alpha,
      { ...zebra, name: "beta" },
    ]);
  });

  it("removes the state owned by a deleted room", () => {
    expect(removeRoom({ r1: [message("a")], r2: [message("b", "r2")] }, "r1")).toEqual({
      r2: [message("b", "r2")],
    });
  });
});

function memoryStorage(): ActiveRoomStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

describe("readActiveRoomId", () => {
  it("returns null when nothing is stored", () => {
    expect(readActiveRoomId(memoryStorage())).toBeNull();
  });

  it("returns the stored room id", () => {
    const storage = memoryStorage();
    storage.setItem(ACTIVE_ROOM_STORAGE_KEY, "r1");

    expect(readActiveRoomId(storage)).toBe("r1");
  });

  it("returns null when storage is unavailable", () => {
    expect(readActiveRoomId(null)).toBeNull();
  });
});

describe("writeActiveRoomId", () => {
  it("stores the room id", () => {
    const storage = memoryStorage();
    writeActiveRoomId(storage, "r1");

    expect(storage.getItem(ACTIVE_ROOM_STORAGE_KEY)).toBe("r1");
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => writeActiveRoomId(null, "r1")).not.toThrow();
  });
});

describe("clearActiveRoomId", () => {
  it("removes the stored room id", () => {
    const storage = memoryStorage();
    storage.setItem(ACTIVE_ROOM_STORAGE_KEY, "r1");
    clearActiveRoomId(storage);

    expect(storage.getItem(ACTIVE_ROOM_STORAGE_KEY)).toBeNull();
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => clearActiveRoomId(null)).not.toThrow();
  });
});

const wsRoomId = "00000000-0000-4000-8000-000000000001";
const wsMessageId = "00000000-0000-4000-8000-000000000002";
const wsUserId = "00000000-0000-4000-8000-000000000003";
const wsTimestamp = "2026-08-13T00:00:00Z";

function messageEvent(data: unknown): MessageEvent {
  return { data: JSON.stringify(data) } as MessageEvent;
}

describe("parseFrame", () => {
  it("parses a valid json frame", () => {
    const raw = messageEvent({
      v: 1,
      type: "message.created",
      topic: `room:${wsRoomId}`,
      ts: wsTimestamp,
      data: {
        id: wsMessageId,
        room_id: wsRoomId,
        user_id: wsUserId,
        username: "luan",
        content: "oi",
        created_at: wsTimestamp,
      },
    });
    expect(parseFrame(raw).type).toBe("message");
  });

  it("parses an updated frame without username and created_at", () => {
    const raw = messageEvent({
      v: 1,
      type: "message.updated",
      topic: `room:${wsRoomId}`,
      ts: wsTimestamp,
      data: {
        content_id: wsMessageId,
        room_id: wsRoomId,
        user_id: wsUserId,
        content: "oi editado",
      },
    });
    const event = parseFrame(raw);
    expect(event).toMatchObject({ action: "updated", content: "oi editado" });
  });

  it("parses room.created on the global app:rooms topic", () => {
    const created = messageEvent({
      v: 1,
      type: "room.created",
      topic: "app:rooms",
      ts: wsTimestamp,
      data: { id: wsRoomId, name: "nova-sala", type: "voice", created_at: wsTimestamp },
    });

    expect(parseFrame(created)).toMatchObject({
      type: "room",
      action: "created",
      id: wsRoomId,
      name: "nova-sala",
      room_type: "voice",
      created_at: wsTimestamp,
    });
  });

  it("parses room.created on any topic", () => {
    const created = messageEvent({
      v: 1,
      type: "room.created",
      topic: `room:${wsRoomId}`,
      ts: wsTimestamp,
      data: { id: wsRoomId, name: "outra", type: "text", created_at: wsTimestamp },
    });

    expect(parseFrame(created)).toMatchObject({
      type: "room",
      action: "created",
      id: wsRoomId,
      created_at: wsTimestamp,
    });
  });

  it("parses room.updated on the per-room topic", () => {
    const updated = messageEvent({
      v: 1,
      type: "room.updated",
      topic: `room:${wsRoomId}`,
      ts: wsTimestamp,
      data: { id: wsRoomId, name: "geral", type: "text", created_at: wsTimestamp },
    });

    expect(parseFrame(updated)).toMatchObject({
      type: "room",
      action: "updated",
      id: wsRoomId,
      name: "geral",
      created_at: wsTimestamp,
    });
  });

  it("parses room.updated on the global app:rooms topic", () => {
    const updated = messageEvent({
      v: 1,
      type: "room.updated",
      topic: "app:rooms",
      ts: wsTimestamp,
      data: { id: wsRoomId, name: "global-update", type: "voice", created_at: wsTimestamp },
    });

    expect(parseFrame(updated)).toMatchObject({
      type: "room",
      action: "updated",
      id: wsRoomId,
      name: "global-update",
      created_at: wsTimestamp,
    });
  });

  it("parses typing frames", () => {
    const raw = messageEvent({
      v: 1,
      type: "typing.start",
      topic: `room:${wsRoomId}`,
      ts: wsTimestamp,
      data: { user_id: wsUserId, username: "luan" },
    });

    expect(parseFrame(raw)).toMatchObject({ type: "typing", action: "start" });
  });

  it("rejects invalid json with an explicit protocol error", () => {
    const raw = { data: "nope" } as MessageEvent;
    expect(() => parseFrame(raw)).toThrow("evento WebSocket incompatível");
  });

  it("rejects the legacy flat protocol", () => {
    const raw = { data: '{"type":"message","id":"m1"}' } as MessageEvent;
    expect(() => parseFrame(raw)).toThrow("evento WebSocket incompatível");
  });

  it.each(["voice.presence.joined", "voice.presence.left", "voice.presence.snapshot"] as const)(
    "accepts %s frames",
    (type) => {
      const raw = messageEvent({
        v: 1,
        type,
        topic: `room:${wsRoomId}`,
        ts: wsTimestamp,
        data: [{ sid: "p1", user_id: wsUserId, username: "luan" }],
      });
      expect(parseFrame(raw)).toMatchObject({
        type,
        room_id: wsRoomId,
      });
    },
  );

  it("rejects a room topic without an UUID", () => {
    const raw = messageEvent({
      v: 1,
      type: "typing.start",
      topic: "room:r1",
      ts: wsTimestamp,
      data: { user_id: wsUserId, username: "luan" },
    });
    expect(() => parseFrame(raw)).toThrow("evento WebSocket incompatível");
  });

  it("rejects a frame larger than the limit", () => {
    const raw = {
      data: "x".repeat(MAX_FRAME_BYTES + 1),
    } as MessageEvent;
    expect(() => parseFrame(raw)).toThrow("frame WebSocket grande demais");
  });
});

describe("typing users", () => {
  const start = {
    type: "typing" as const,
    action: "start" as const,
    room_id: "r1",
    user_id: "u2",
    username: "Luan",
  };

  it("adds, refreshes and removes a typing user", () => {
    const added = updateTypingUsers({}, start, "u1", 1000);
    const refreshed = updateTypingUsers(added, start, "u1", 2000);
    const removed = updateTypingUsers(refreshed, { ...start, action: "stop" }, "u1", 2000);

    expect(added).toMatchObject({ r1: { u2: { lastTypedAt: 1000 } } });
    expect(refreshed).toMatchObject({ r1: { u2: { lastTypedAt: 2000 } } });
    expect(removed).toEqual({});
  });

  it("ignores events from the current user", () => {
    expect(updateTypingUsers({}, { ...start, user_id: "u1" }, "u1", 1000)).toEqual({});
  });

  it("expires users after the timeout", () => {
    const users = updateTypingUsers({}, start, "u1", 1000);

    expect(expireTypingUsers(users, 3999, 3000)).toBe(users);
    expect(expireTypingUsers(users, 4000, 3000)).toEqual({});
  });

  it("formats one or multiple names", () => {
    const luan = { userId: "u1", username: "Luan", lastTypedAt: 1000 };
    const bia = { userId: "u2", username: "Bia", lastTypedAt: 1000 };
    const ana = { userId: "u3", username: "Ana", lastTypedAt: 1000 };

    expect(typingIndicatorText([])).toBeNull();
    expect(typingIndicatorText([luan])).toBe("Luan está digitando...");
    expect(typingIndicatorText([luan, bia])).toBe("Luan e Bia estão digitando...");
    expect(typingIndicatorText([luan, bia, ana])).toBe(
      "Várias pessoas estão digitando ao mesmo tempo...",
    );
  });
});

describe("voice presence", () => {
  const participant = {
    sid: "PA_1",
    user_id: "u1",
    username: "Luan",
  };
  const snapshot = {
    type: "voice.presence.snapshot" as const,
    room_id: "r1",
    participants: [participant],
  };

  it("stores the latest room snapshot", () => {
    expect(updateVoicePresence({}, snapshot)).toEqual({ r1: [participant] });
  });

  it("deduplicates participants by user id", () => {
    const duplicate = { ...participant, sid: "PA_2" };
    const presence = updateVoicePresence(
      {},
      {
        ...snapshot,
        participants: [participant, duplicate],
      },
    );

    expect(presence["r1"]).toEqual([duplicate]);
  });

  it.each(["voice.presence.joined", "voice.presence.left"] as const)(
    "replaces the snapshot on %s",
    (type) => {
      const previous = { r1: [participant], r2: [{ ...participant, user_id: "u2" }] };
      const next = updateVoicePresence(previous, {
        ...snapshot,
        type,
        participants: [{ ...participant, username: "Luan atualizado" }],
      });

      expect(next["r1"]?.[0]?.username).toBe("Luan atualizado");
      expect(next["r2"]).toBe(previous["r2"]);
    },
  );

  it("removes an empty room snapshot", () => {
    expect(updateVoicePresence({ r1: [participant] }, { ...snapshot, participants: [] })).toEqual(
      {},
    );
  });
});
