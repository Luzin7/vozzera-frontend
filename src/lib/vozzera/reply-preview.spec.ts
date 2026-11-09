import { describe, expect, it } from "vitest";

import { REPLY_PREVIEW_MAX_LENGTH, replyPreviewText } from "@/lib/vozzera/reply-preview";

describe("replyPreviewText", () => {
  it("returns an empty string without content", () => {
    expect(replyPreviewText(null)).toBe("");
    expect(replyPreviewText(undefined)).toBe("");
  });

  it("keeps the text when it fits the limit", () => {
    const text = "a".repeat(REPLY_PREVIEW_MAX_LENGTH);
    expect(replyPreviewText(text)).toBe(text);
  });

  it("truncates above the limit and marks the cut", () => {
    const text = "a".repeat(REPLY_PREVIEW_MAX_LENGTH + 1);
    expect(replyPreviewText(text)).toBe(`${"a".repeat(REPLY_PREVIEW_MAX_LENGTH)}…`);
  });

  it("collapses line breaks into a single line", () => {
    expect(replyPreviewText("oi\n  tudo bem")).toBe("oi tudo bem");
  });
});
