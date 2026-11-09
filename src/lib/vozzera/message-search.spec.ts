import { describe, expect, it } from "vitest";

import { filterMessagesByQuery, normalizeSearchText } from "@/lib/vozzera/message-search";
import type { ChatMessage } from "@/lib/vozzera/types";

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    roomId: "r1",
    userId: "u1",
    username: "luan",
    content: "oi",
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "",
    ...overrides,
  };
}

function ids(messages: ChatMessage[]): string[] {
  return messages.map((message) => message.id);
}

describe("normalizeSearchText", () => {
  it("strips case and accents", () => {
    expect(normalizeSearchText("Ação CONCLUÍDA")).toBe("acao concluida");
  });

  it("keeps plain text untouched apart from case", () => {
    expect(normalizeSearchText("Bom dia")).toBe("bom dia");
  });
});

describe("filterMessagesByQuery", () => {
  const messages = [
    message({ id: "a", username: "Luan", content: "Bom dia, pessoal" }),
    message({ id: "b", username: "Ana", content: "Ação concluída" }),
    message({ id: "c", username: "João", content: "sem sotaque" }),
  ];

  it("matches content ignoring case and accents", () => {
    expect(ids(filterMessagesByQuery(messages, "ACAO"))).toEqual(["b"]);
    expect(ids(filterMessagesByQuery(messages, "ação"))).toEqual(["b"]);
  });

  it("matches the username ignoring case and accents", () => {
    expect(ids(filterMessagesByQuery(messages, "joao"))).toEqual(["c"]);
    expect(ids(filterMessagesByQuery(messages, "JOÃO"))).toEqual(["c"]);
  });

  it("keeps the original order", () => {
    expect(ids(filterMessagesByQuery(messages, "o"))).toEqual(["a", "b", "c"]);
  });

  it("returns every message for an empty query", () => {
    expect(ids(filterMessagesByQuery(messages, ""))).toEqual(["a", "b", "c"]);
    expect(ids(filterMessagesByQuery(messages, "   "))).toEqual(["a", "b", "c"]);
  });

  it("ignores surrounding spaces in the query", () => {
    expect(ids(filterMessagesByQuery(messages, "  concluida  "))).toEqual(["b"]);
  });

  it("returns nothing when no message matches", () => {
    expect(filterMessagesByQuery(messages, "inexistente")).toEqual([]);
  });
});
