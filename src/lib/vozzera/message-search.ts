import type { ChatMessage } from "@/lib/vozzera/types";

const DIACRITICS = /[\u0300-\u036f]/g;

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

export function filterMessagesByQuery(
  messages: readonly ChatMessage[],
  query: string,
): ChatMessage[] {
  const normalizedQuery = normalizeSearchText(query).trim();
  if (normalizedQuery.length === 0) return [...messages];

  return messages.filter((message) =>
    [message.content, message.username].some((field) =>
      normalizeSearchText(field).includes(normalizedQuery),
    ),
  );
}
