export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; url: string; children: Inline[] }
  | { kind: "room"; roomName: string };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "heading"; level: number; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] };

export type BareUrlMatch = { url: string; length: number };

type InlineMatch = { node: Inline; length: number };
type BlockMatch = { block: Block; length: number };

const CODE_DELIMITER = "`";
const BOLD_DELIMITER = "**";
const ITALIC_DELIMITER = "*";
const ROOM_DELIMITER = "#";
const FENCE = "```";
const TRAILING_PUNCTUATION = ".,;:!?";

const SAFE_URL_PATTERN = /^https?:\/\//i;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>"'`*]+/i;
const ROOM_PATTERN = /^#([^\s#]+)/;
const HEADING_PATTERN = /^(#{1,6})\s+/;
const UNORDERED_LIST_PATTERN = /^[-*]\s+/;
const ORDERED_LIST_PATTERN = /^\d+\.\s+/;
const LIST_ITEM_PATTERN = /^([-*]|\d+\.)\s+/;

function isSafeUrl(url: string): boolean {
  return SAFE_URL_PATTERN.test(url);
}

function isWhitespace(value: string | undefined): boolean {
  return value !== undefined && /\s/.test(value);
}

function matchCode(rest: string): InlineMatch | null {
  if (!rest.startsWith(CODE_DELIMITER)) return null;

  const end = rest.indexOf(CODE_DELIMITER, CODE_DELIMITER.length);

  if (end === -1)
    return { node: { kind: "text", text: CODE_DELIMITER }, length: CODE_DELIMITER.length };

  return {
    node: { kind: "code", text: rest.slice(CODE_DELIMITER.length, end) },
    length: end + CODE_DELIMITER.length,
  };
}

function matchBold(rest: string): InlineMatch | null {
  if (!rest.startsWith(BOLD_DELIMITER)) return null;

  const end = rest.indexOf(BOLD_DELIMITER, BOLD_DELIMITER.length);

  if (end === -1)
    return { node: { kind: "text", text: BOLD_DELIMITER }, length: BOLD_DELIMITER.length };

  return {
    node: { kind: "bold", children: parseInline(rest.slice(BOLD_DELIMITER.length, end)) },
    length: end + BOLD_DELIMITER.length,
  };
}

function matchItalic(rest: string): InlineMatch | null {
  if (!rest.startsWith(ITALIC_DELIMITER)) return null;

  const end = rest.indexOf(ITALIC_DELIMITER, ITALIC_DELIMITER.length);

  if (end === -1) {
    return { node: { kind: "text", text: ITALIC_DELIMITER }, length: ITALIC_DELIMITER.length };
  }

  return {
    node: { kind: "italic", children: parseInline(rest.slice(ITALIC_DELIMITER.length, end)) },
    length: end + ITALIC_DELIMITER.length,
  };
}

function matchLink(rest: string): InlineMatch | null {
  if (!rest.startsWith("[")) return null;

  const open = rest.indexOf("](", 1);
  if (open === -1) return null;

  const close = rest.indexOf(")", open + 2);
  if (close === -1) return null;

  const url = rest.slice(open + 2, close).trim();
  if (!isSafeUrl(url)) return null;

  return {
    node: { kind: "link", url, children: parseInline(rest.slice(1, open)) },
    length: close + 1,
  };
}

function matchRoom(rest: string, atWordStart: boolean): InlineMatch | null {
  if (!rest.startsWith(ROOM_DELIMITER)) return null;

  const roomName = ROOM_PATTERN.exec(rest)?.[1];
  if (roomName === undefined || !atWordStart) return null;

  return { node: { kind: "room", roomName }, length: roomName.length + 1 };
}

function trimTrailingPunctuation(url: string): string {
  let end = url.length;

  while (end > 0) {
    const last = url[end - 1];
    if (last === undefined || !TRAILING_PUNCTUATION.includes(last)) break;
    end -= 1;
  }

  return url.slice(0, end);
}

function trimUnbalancedParenthesis(url: string): string {
  let balance = 0;

  for (const char of url) {
    if (char === "(") balance += 1;
    if (char === ")") balance -= 1;
  }

  let end = url.length;

  while (end > 0 && balance < 0 && url[end - 1] === ")") {
    end -= 1;
    balance += 1;
  }

  return url.slice(0, end);
}

export function matchBareUrl(rest: string): BareUrlMatch | null {
  const found = BARE_URL_PATTERN.exec(rest);
  if (found === null) return null;
  if (found.index !== 0) return null;

  const url = trimUnbalancedParenthesis(trimTrailingPunctuation(found[0]));

  return { url, length: url.length };
}

function matchInline(rest: string, atWordStart: boolean): InlineMatch | null {
  const markerMatch =
    matchCode(rest) ??
    matchBold(rest) ??
    matchItalic(rest) ??
    matchLink(rest) ??
    matchRoom(rest, atWordStart);

  if (markerMatch !== null) return markerMatch;

  const bare = matchBareUrl(rest);
  if (bare === null) return null;

  return {
    node: { kind: "link", url: bare.url, children: [{ kind: "text", text: bare.url }] },
    length: bare.length,
  };
}

export function parseInline(input: string): Inline[] {
  const nodes: Inline[] = [];
  let text = "";
  let i = 0;

  const flushText = () => {
    if (!text) return;
    nodes.push({ kind: "text", text });
    text = "";
  };

  while (i < input.length) {
    const rest = input.slice(i);
    const match = matchInline(rest, i === 0 || isWhitespace(input[i - 1]));

    if (match === null) {
      text += input[i] ?? "";
      i += 1;
      continue;
    }

    if (match.node.kind === "text") {
      text += match.node.text;
      i += match.length;
      continue;
    }

    flushText();
    nodes.push(match.node);
    i += match.length;
  }

  flushText();
  return nodes;
}

function matchFencedCode(lines: string[], start: number): BlockMatch | null {
  const line = lines[start];
  if (!line?.trimStart().startsWith(FENCE)) return null;

  const code: string[] = [];
  let i = start + 1;

  while (i < lines.length) {
    const current = lines[i];
    if (current === undefined || current.trimStart().startsWith(FENCE)) break;

    code.push(current);
    i += 1;
  }

  return { block: { kind: "code", text: code.join("\n") }, length: i + 1 - start };
}

function matchHeading(lines: string[], start: number): BlockMatch | null {
  const line = lines[start];
  if (line === undefined) return null;

  const match = HEADING_PATTERN.exec(line);
  const marker = match?.[1];
  if (match === null || marker === undefined) return null;

  return {
    block: {
      kind: "heading",
      level: marker.length,
      children: parseInline(line.slice(match[0].length)),
    },
    length: 1,
  };
}

function matchQuote(lines: string[], start: number): BlockMatch | null {
  const line = lines[start];
  if (!line?.startsWith(">")) return null;

  const quote: string[] = [];
  let i = start;

  while (i < lines.length) {
    const current = lines[i];
    if (!current?.startsWith(">")) break;

    quote.push(current.slice(1).replace(/^ /, ""));
    i += 1;
  }

  return { block: { kind: "quote", children: parseInline(quote.join("\n")) }, length: i - start };
}

function matchList(lines: string[], start: number): BlockMatch | null {
  const line = lines[start];
  if (line === undefined) return null;

  const ordered = ORDERED_LIST_PATTERN.test(line);
  if (!ordered && !UNORDERED_LIST_PATTERN.test(line)) return null;

  const items: Inline[][] = [];
  let i = start;

  while (i < lines.length) {
    const current = lines[i];
    if (current === undefined) break;

    const match = LIST_ITEM_PATTERN.exec(current);
    if (match === null) break;

    items.push(parseInline(current.slice(match[0].length)));
    i += 1;
  }

  return { block: { kind: "list", ordered, items }, length: i - start };
}

function isBlockBoundary(line: string): boolean {
  if (line.startsWith(">")) return true;
  if (line.trimStart().startsWith(FENCE)) return true;
  if (HEADING_PATTERN.test(line)) return true;
  if (UNORDERED_LIST_PATTERN.test(line)) return true;
  return ORDERED_LIST_PATTERN.test(line);
}

function matchParagraph(lines: string[], start: number): BlockMatch | null {
  const paragraph: string[] = [];
  let i = start;

  while (i < lines.length) {
    const current = lines[i];
    if (current === undefined || current.trim() === "" || isBlockBoundary(current)) break;

    paragraph.push(current);
    i += 1;
  }

  if (paragraph.length === 0) return null;

  return {
    block: { kind: "paragraph", children: parseInline(paragraph.join("\n")) },
    length: i - start,
  };
}

function matchBlock(lines: string[], start: number): BlockMatch | null {
  return (
    matchFencedCode(lines, start) ??
    matchHeading(lines, start) ??
    matchQuote(lines, start) ??
    matchList(lines, start) ??
    matchParagraph(lines, start)
  );
}

export function parseBlocks(input: string): Block[] {
  const lines = input.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === undefined || line.trim() === "") {
      i += 1;
      continue;
    }

    const match = matchBlock(lines, i);

    if (match === null) {
      i += 1;
      continue;
    }

    blocks.push(match.block);
    i += match.length;
  }

  return blocks;
}
