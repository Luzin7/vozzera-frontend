import { describe, expect, it } from "vitest";

import { fromEvent, fromHistory } from "./types";
import type { HistoryMessage, OutboundEvent } from "./types";

describe("fromHistory", () => {
  const history: HistoryMessage = {
    id: "m1",
    content: "oi",
    created_at: "2026-08-13T00:00:00Z",
    user_id: "u1",
    username: "luan",
  };

  it("maps snake_case into camelCase and injects roomId", () => {
    expect(fromHistory(history, "r1")).toEqual({
      id: "m1",
      roomId: "r1",
      userId: "u1",
      username: "luan",
      content: "oi",
      createdAt: "2026-08-13T00:00:00Z",
    });
  });
});

describe("fromEvent", () => {
  const base: OutboundEvent = {
    type: "message",
    id: "m1",
    room_id: "r1",
    user_id: "u1",
    created_at: "2026-08-13T00:00:00Z",
  };

  it("maps the envelope into a ChatMessage", () => {
    expect(fromEvent({ ...base, username: "luan", content: "oi" })).toEqual({
      id: "m1",
      roomId: "r1",
      userId: "u1",
      username: "luan",
      content: "oi",
      createdAt: "2026-08-13T00:00:00Z",
    });
  });

  it("defaults missing username and content", () => {
    expect(fromEvent(base)).toMatchObject({ username: "?", content: "" });
  });
});
