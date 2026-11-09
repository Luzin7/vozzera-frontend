import { z } from "zod";

import type { AwayCommand } from "@/lib/vozzera/away-intent";
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
  replyToMessageId?: string,
): InboundEvent {
  const data: InboundEvent["data"] = { room_id: roomId };
  if (content !== undefined) data.content = content;
  if (replyToMessageId) data.reply_to_message_id = replyToMessageId;

  return {
    v: 1,
    type,
    topic: `room:${roomId}`,
    ts: new Date().toISOString(),
    data,
  };
}

export function awayFrame(command: AwayCommand): InboundEvent {
  const ts = new Date().toISOString();
  if (command.type === "leave") {
    return { v: 1, type: "voice.away.leave", topic: "__presence__", ts, data: {} };
  }

  const { roomId, reason } = command.intent;
  return {
    v: 1,
    type: "voice.away.enter",
    topic: `room:${roomId}`,
    ts,
    data: { room_id: roomId, reason },
  };
}

const uuid = z.string().uuid();
const roomTopic = z
  .string()
  .regex(/^room:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const timestamp = z.string().datetime({ offset: true });

const knownOutboundTypes = new Set<string>();
export const KNOWN_OUTBOUND_TYPES: ReadonlySet<string> = knownOutboundTypes;

const envelope = <Type extends string, Topic extends z.ZodType<string>, Data extends z.ZodTypeAny>(
  type: Type,
  topic: Topic,
  data: Data,
) => {
  knownOutboundTypes.add(type);
  return z.object({
    v: z.literal(1),
    type: z.literal(type),
    topic,
    ts: timestamp,
    data,
  });
};

const roomData = z.object({
  id: uuid,
  name: z.string(),
  has_voice: z.boolean(),
  staff_only: z.boolean(),
  created_at: timestamp,
});

const roomDeletedData = z.object({ id: uuid, is_mod: z.boolean() });

const replyPreview = z.object({
  id: uuid,
  username: z.string(),
  content: z.string(),
});

const messageCreatedData = z.object({
  id: uuid,
  room_id: uuid,
  user_id: uuid,
  username: z.string(),
  content: z.string(),
  created_at: timestamp,
  reply_to: replyPreview.nullable(),
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
    envelope("room.created", z.string(), roomData),
    envelope("room.updated", z.string(), roomData),
  ])
  .transform((frame): OutboundEvent => ({
    type: "room",
    action: frame.type === "room.created" ? "created" : "updated",
    id: frame.data.id,
    name: frame.data.name,
    has_voice: frame.data.has_voice,
    staff_only: frame.data.staff_only,
    created_at: frame.data.created_at,
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

const awayEntry = z.object({ user_id: uuid, username: z.string(), since: timestamp });

const awaySnapshotFrame = envelope("voice.away.snapshot", roomTopic, z.array(awayEntry)).transform(
  (frame): OutboundEvent => ({
    type: "voice.away.snapshot",
    room_id: roomIdFromTopic(frame.topic),
    away: frame.data.map((entry) => ({
      userId: entry.user_id,
      username: entry.username,
      since: entry.since,
    })),
  }),
);

const awayEndedFrame = envelope(
  "voice.away.ended",
  roomTopic,
  z.object({ user_id: uuid, reason: z.enum(["room_empty", "returned", "connection_closed"]) }),
).transform((frame): OutboundEvent => ({
  type: "voice.away.ended",
  room_id: roomIdFromTopic(frame.topic),
  user_id: frame.data.user_id,
  reason: frame.data.reason,
}));

const awayResyncFrame = envelope(
  "voice.away.resync",
  z.literal("__presence__"),
  z.object({}).passthrough(),
).transform((): OutboundEvent => ({ type: "voice.away.resync" }));

const sessionSnapshotFrame = envelope(
  "voice.session.snapshot",
  roomTopic,
  z.object({ started_at: timestamp.nullable() }),
).transform((frame): OutboundEvent => ({
  type: "voice.session.snapshot",
  room_id: roomIdFromTopic(frame.topic),
  started_at: frame.data.started_at,
  server_ts: frame.ts,
}));

const systemErrorFrame = envelope(
  "system.error",
  z.string(),
  z.object({ error: z.string() }),
).transform((frame): OutboundEvent => ({ type: "error", error: frame.data.error }));

const presenceTopic = z.literal("__presence__");
const presenceUserData = z.object({ user_id: z.string(), username: z.string() });

const userOnlineFrame = envelope("user.online", presenceTopic, presenceUserData).transform(
  (frame): OutboundEvent => ({
    type: "user.online",
    userId: frame.data.user_id,
    username: frame.data.username,
  }),
);

const userOfflineFrame = envelope("user.offline", presenceTopic, presenceUserData).transform(
  (frame): OutboundEvent => ({
    type: "user.offline",
    userId: frame.data.user_id,
    username: frame.data.username,
  }),
);

const presenceSnapshotFrame = envelope(
  "presence.snapshot",
  presenceTopic,
  z.object({
    online: z.number(),
    offline: z.number(),
    total: z.number(),
    online_users: z.array(presenceUserData).optional(),
    offline_users: z.array(presenceUserData).optional(),
  }),
).transform((frame): OutboundEvent => ({
  type: "presence.snapshot",
  online: frame.data.online,
  offline: frame.data.offline,
  total: frame.data.total,
  online_users: (frame.data.online_users ?? []).map((u) => ({
    userId: u.user_id,
    username: u.username,
  })),
  offline_users: (frame.data.offline_users ?? []).map((u) => ({
    userId: u.user_id,
    username: u.username,
  })),
}));

export const outboundFrameSchema = z.union([
  roomChangedFrame,
  roomDeletedFrame,
  messageCreatedFrame,
  messageUpdatedFrame,
  messageDeletedFrame,
  typingFrame,
  presenceFrame,
  userOnlineFrame,
  userOfflineFrame,
  presenceSnapshotFrame,
  awaySnapshotFrame,
  awayEndedFrame,
  awayResyncFrame,
  sessionSnapshotFrame,
  systemErrorFrame,
]);
