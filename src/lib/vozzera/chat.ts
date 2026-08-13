import type { ChatMessage, OutboundEvent, Room } from "./types";

export function appendMessage(
  messages: Record<string, ChatMessage[]>,
  message: ChatMessage,
): Record<string, ChatMessage[]> {
  const current = messages[message.roomId] ?? [];
  if (current.some((m) => m.id === message.id)) return messages;
  return { ...messages, [message.roomId]: [...current, message] };
}

export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15000);
}

export function firstTextRoom(rooms: Room[]): Room | undefined {
  return rooms.find((room) => room.type === "text");
}

export function parseFrame(raw: MessageEvent): OutboundEvent | null {
  try {
    return JSON.parse(raw.data as string) as OutboundEvent;
  } catch {
    return null;
  }
}
