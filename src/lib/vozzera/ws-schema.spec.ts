import { describe, expect, it } from "vitest";

import type { InboundEventType } from "@/lib/vozzera/types";
import { awayFrame, inboundFrame } from "@/lib/vozzera/ws-schema";

describe("inboundFrame", () => {
  const roomId = "00000000-0000-4000-8000-000000000001";
  const roomCommands: InboundEventType[] = [
    "room.subscribe",
    "room.unsubscribe",
    "typing.start",
    "typing.stop",
  ];

  it.each(roomCommands)("builds a versioned %s command", (type) => {
    expect(inboundFrame(type, roomId)).toMatchObject({
      v: 1,
      type,
      topic: `room:${roomId}`,
      data: { room_id: roomId },
    });
  });

  it("puts message content inside data", () => {
    expect(inboundFrame("message", roomId, "oi").data).toEqual({
      room_id: roomId,
      content: "oi",
    });
  });
});

describe("awayFrame", () => {
  const roomId = "00000000-0000-4000-8000-000000000001";

  it("builds voice.away.enter on the room topic without a user id", () => {
    expect(awayFrame({ type: "enter", intent: { roomId, reason: "idle" } })).toMatchObject({
      v: 1,
      type: "voice.away.enter",
      topic: `room:${roomId}`,
      data: { room_id: roomId, reason: "idle" },
    });
  });

  it("carries the connection reason", () => {
    expect(awayFrame({ type: "enter", intent: { roomId, reason: "connection" } }).data).toEqual({
      room_id: roomId,
      reason: "connection",
    });
  });

  it("builds voice.away.leave on the presence topic with empty data", () => {
    expect(awayFrame({ type: "leave" })).toMatchObject({
      v: 1,
      type: "voice.away.leave",
      topic: "__presence__",
      data: {},
    });
  });
});
