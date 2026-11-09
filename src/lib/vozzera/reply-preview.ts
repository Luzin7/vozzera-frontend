export const REPLY_PREVIEW_MAX_LENGTH = 120;

export function replyPreviewText(content: string | null | undefined): string {
  if (!content) return "";

  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= REPLY_PREVIEW_MAX_LENGTH) return text;

  return `${text.slice(0, REPLY_PREVIEW_MAX_LENGTH).trimEnd()}…`;
}
