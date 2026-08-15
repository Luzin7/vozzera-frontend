import { z } from "zod";

import { MAX_MESSAGE_LENGTH } from "./types";

export const MAX_FRAME_BYTES = MAX_MESSAGE_LENGTH + 4096;

const messageBase = z.object({
  type: z.literal("message"),
  id: z.string(),
  room_id: z.string(),
  user_id: z.string(),
});

const messageCreatedUpdated = messageBase.extend({
  action: z.union([z.literal("created"), z.literal("updated")]),
  username: z.string(),
  content: z.string(),
  created_at: z.string(),
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

const error = z.object({
  type: z.literal("error"),
  error: z.string(),
});

export const outboundFrameSchema = z.union([
  messageCreatedUpdated,
  messageDeleted,
  presence,
  error,
]);
