import { z } from "zod";

import {
  MAX_MESSAGE_LENGTH,
  type InboundEvent,
  type InboundEventType,
  type OutboundEvent,
} from "@/lib/vozzera/types";

export const MAX_FRAME_BYTES = MAX_MESSAGE_LENGTH + 4096;

export function inboundFrame(
  type: InboundEventType,
  roomId: string,
  content?: string,
): InboundEvent {
  return {
    v: 1,
    type,
    topic: `room:${roomId}`,
    ts: new Date().toISOString(),
    data: content === undefined ? { room_id: roomId } : { room_id: roomId, content },
  };
}

const uuid = z.string().uuid();
const roomTopic = z
  .string()
  .regex(/^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const timestamp = z.string().datetime({ offset: true });

const envelope = <Type extends string, Topic extends z.ZodType<string>, Data extends z.ZodTypeAny>(
  type: Type,
  topic: Topic,
  data: Data,
) =>
  z.object({
    v: z.literal(1),
    type: z.literal(type),
    topic,
    ts: timestamp,
    data,
  });

const roomData = z.object({
  id: uuid,
  name: z.string(),
  type: z.union([z.literal("text"), z.literal("voice")]),
  created_at: timestamp,
});

const roomDeletedData = z.object({ id: uuid, is_mod: z.boolean() });

const messageCreatedData = z.object({
  id: uuid,
  room_id: uuid,
  user_id: uuid,
  username: z.string(),
  content: z.string(),
  created_at: timestamp,
});

const messageUpdatedData = z.object({
  content_id: uuid,
  room_id: uuid,
  user_id: uuid,
  content: z.string(),
});

const messageDeletedData = z.object({
  content_id: uuid,
  room_id: uuid,
  user_id: uuid,
  is_mod: z.boolean(),
});

const typingData = z.object({ user_id: uuid, username: z.string() });
const participant = z.object({ sid: z.string(), user_id: z.string(), username: z.string() });

function roomIdFromTopic(topic: string): string {
  return topic.slice("room:".length);
}

const roomChangedFrame = z
  .union([
    envelope("room.created", z.literal("app:rooms"), roomData),
    envelope("room.updated", roomTopic, roomData),
  ])
  .transform((frame): OutboundEvent => ({
    type: "room",
    action: frame.type === "room.created" ? "created" : "updated",
    id: frame.data.id,
    name: frame.data.name,
    room_type: frame.data.type,
  }));

const roomDeletedFrame = envelope("room.deleted", roomTopic, roomDeletedData).transform(
  (frame): OutboundEvent => ({ type: "room", action: "deleted", id: frame.data.id }),
);

const messageCreatedFrame = envelope("message.created", roomTopic, messageCreatedData).transform(
  (frame): OutboundEvent => ({ type: "message", action: "created", ...frame.data }),
);

const messageUpdatedFrame = envelope("message.updated", roomTopic, messageUpdatedData).transform(
  (frame): OutboundEvent => ({
    type: "message",
    action: "updated",
    id: frame.data.content_id,
    room_id: frame.data.room_id,
    user_id: frame.data.user_id,
    content: frame.data.content,
    updated_at: frame.ts,
  }),
);

const messageDeletedFrame = envelope("message.deleted", roomTopic, messageDeletedData).transform(
  (frame): OutboundEvent => ({
    type: "message",
    action: "deleted",
    id: frame.data.content_id,
    room_id: frame.data.room_id,
    user_id: frame.data.user_id,
    updated_at: frame.ts,
  }),
);

const typingFrame = z
  .union([
    envelope("typing.start", roomTopic, typingData),
    envelope("typing.stop", roomTopic, typingData),
  ])
  .transform((frame): OutboundEvent => ({
    type: "typing",
    action: frame.type === "typing.start" ? "start" : "stop",
    room_id: roomIdFromTopic(frame.topic),
    user_id: frame.data.user_id,
    username: frame.data.username,
  }));

const presenceFrame = z
  .union([
    envelope("voice.presence.joined", roomTopic, z.array(participant)),
    envelope("voice.presence.left", roomTopic, z.array(participant)),
    envelope("voice.presence.snapshot", roomTopic, z.array(participant)),
  ])
  .transform((frame): OutboundEvent => ({
    type: frame.type,
    room_id: roomIdFromTopic(frame.topic),
    participants: frame.data,
  }));

const systemErrorFrame = envelope(
  "system.error",
  z.string(),
  z.object({ error: z.string() }),
).transform((frame): OutboundEvent => ({ type: "error", error: frame.data.error }));

export const outboundFrameSchema = z.union([
  roomChangedFrame,
  roomDeletedFrame,
  messageCreatedFrame,
  messageUpdatedFrame,
  messageDeletedFrame,
  typingFrame,
  presenceFrame,
  systemErrorFrame,
]);
