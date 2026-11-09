import { describe, expect, it } from "vitest";

import { fromEvent, type InboundEventType, type OutboundEvent } from "@/lib/vozzera/types";
import {
  KNOWN_OUTBOUND_TYPES,
  awayFrame,
  inboundFrame,
  outboundFrameSchema,
} from "@/lib/vozzera/ws-schema";

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

  it("carries the replied message id when present", () => {
    expect(
      inboundFrame("message", roomId, "oi", "00000000-0000-4000-8000-000000000002").data,
    ).toEqual({
      room_id: roomId,
      content: "oi",
      reply_to_message_id: "00000000-0000-4000-8000-000000000002",
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

describe("voice.session.snapshot frame", () => {
  const roomId = "00000000-0000-4000-8000-000000000001";
  const serverTs = "2026-11-05T12:00:00.000Z";
  const frame = (topic: string, data: unknown) => ({
    v: 1,
    type: "voice.session.snapshot",
    topic,
    ts: serverTs,
    data,
  });

  it("parses started_at as a string and maps the envelope ts to server_ts", () => {
    const startedAt = "2026-11-05T10:00:00.000Z";
    expect(outboundFrameSchema.parse(frame(`room:${roomId}`, { started_at: startedAt }))).toEqual({
      type: "voice.session.snapshot",
      room_id: roomId,
      started_at: startedAt,
      server_ts: serverTs,
    });
  });

  it("parses a null started_at", () => {
    expect(outboundFrameSchema.parse(frame(`room:${roomId}`, { started_at: null }))).toMatchObject({
      started_at: null,
    });
  });

  it("rejects a non-room topic", () => {
    expect(outboundFrameSchema.safeParse(frame("__presence__", { started_at: null })).success).toBe(
      false,
    );
  });

  it("is a known outbound type", () => {
    expect(KNOWN_OUTBOUND_TYPES.has("voice.session.snapshot")).toBe(true);
  });
});

describe("message.created frame without reply_to", () => {
  const roomId = "00000000-0000-4000-8000-000000000001";
  const serverTs = "2026-11-05T12:00:00.000Z";
  const frame = {
    v: 1,
    type: "message.created",
    topic: `room:${roomId}`,
    ts: serverTs,
    data: {
      id: "00000000-0000-4000-8000-000000000002",
      room_id: roomId,
      user_id: "00000000-0000-4000-8000-000000000003",
      username: "luan",
      content: "oi",
      created_at: serverTs,
    },
  };

  it("parses and yields replyTo null", () => {
    const event = outboundFrameSchema.parse(frame);
    expect(event).toMatchObject({ type: "message", action: "created", reply_to: null });
    expect(
      fromEvent(event as Extract<OutboundEvent, { type: "message"; action: "created" }>).replyTo,
    ).toBeNull();
  });
});
