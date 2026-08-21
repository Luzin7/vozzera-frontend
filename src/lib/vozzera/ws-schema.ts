import { z } from "zod";

import { MAX_MESSAGE_LENGTH } from "@/lib/vozzera/types";

export const MAX_FRAME_BYTES = MAX_MESSAGE_LENGTH + 4096;

const messageBase = z.object({
  type: z.literal("message"),
  id: z.string(),
  room_id: z.string(),
  user_id: z.string(),
});

const messageCreated = messageBase.extend({
  action: z.literal("created"),
  username: z.string(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

const messageUpdated = messageBase.extend({
  action: z.literal("updated"),
  content: z.string(),
  updated_at: z.string().optional(),
});

const messageDeleted = messageBase.extend({
  action: z.literal("deleted"),
  updated_at: z.string().optional(),
});

const presence = z.object({
  type: z.literal("presence"),
  id: z.string(),
  room_id: z.string(),
  user_id: z.string(),
  username: z.string(),
});

const typing = z.object({
  type: z.literal("typing"),
  action: z.union([z.literal("start"), z.literal("stop")]),
  room_id: z.string(),
  user_id: z.string(),
  username: z.string(),
});

const error = z.object({
  type: z.literal("error"),
  error: z.string(),
});

const roomChanged = z.object({
  type: z.literal("room"),
  action: z.union([z.literal("created"), z.literal("updated")]),
  id: z.string(),
  name: z.string(),
  room_type: z.union([z.literal("text"), z.literal("voice")]),
});

const roomDeleted = z.object({
  type: z.literal("room"),
  action: z.literal("deleted"),
  id: z.string(),
});

export const outboundFrameSchema = z.union([
  roomChanged,
  roomDeleted,
  messageCreated,
  messageUpdated,
  messageDeleted,
  presence,
  typing,
  error,
]);
