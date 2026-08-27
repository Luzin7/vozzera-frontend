import { describe, expect, it } from "vitest";

import type { InboundEventType } from "@/lib/vozzera/types";
import { inboundFrame } from "@/lib/vozzera/ws-schema";

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
