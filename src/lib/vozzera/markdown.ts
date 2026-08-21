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

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function parseInline(input: string): Inline[] {
  const nodes: Inline[] = [];
  let text = "";
  let i = 0;

  const flushText = () => {
    if (text) {
      nodes.push({ kind: "text", text });
      text = "";
    }
  };

  while (i < input.length) {
    const rest = input.slice(i);

    if (rest.startsWith("`")) {
      const end = input.indexOf("`", i + 1);

      if (end === -1) {
        text += "`";
        i += 1;
        continue;
      }

      flushText();
      nodes.push({ kind: "code", text: input.slice(i + 1, end) });
      i = end + 1;
      continue;
    }

    if (rest.startsWith("**")) {
      const end = input.indexOf("**", i + 2);

      if (end === -1) {
        text += "**";
        i += 2;
        continue;
      }

      flushText();
      nodes.push({ kind: "bold", children: parseInline(input.slice(i + 2, end)) });
      i = end + 2;
      continue;
    }

    if (rest.startsWith("*")) {
      const end = input.indexOf("*", i + 1);

      if (end === -1) {
        text += "*";
        i += 1;
        continue;
      }

      flushText();
      nodes.push({ kind: "italic", children: parseInline(input.slice(i + 1, end)) });
      i = end + 1;
      continue;
    }

    if (rest.startsWith("[")) {
      const open = rest.indexOf("](", 1);

      if (open !== -1) {
        const close = rest.indexOf(")", open + 2);
        const url = close !== -1 ? rest.slice(open + 2, close).trim() : "";

        if (close !== -1 && isSafeUrl(url)) {
          flushText();
          nodes.push({ kind: "link", url, children: parseInline(rest.slice(1, open)) });
          i += close + 1;
          continue;
        }
      }

      text += "[";
      i += 1;
      continue;
    }

    if (rest.startsWith("#")) {
      const match = rest.match(/^#([\w-]+)/);
      const roomName = match?.[1];

      if (roomName && (i === 0 || /\s/.test(input[i - 1] ?? ""))) {
        flushText();
        nodes.push({ kind: "room", roomName });
        i += roomName.length + 1;
        continue;
      }
    }

    text += input[i];
    i += 1;
  }

  flushText();
  return nodes;
}

export function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === undefined) {
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i += 1;

      while (i < lines.length) {
        const current = lines[i];

        if (current === undefined || current.trimStart().startsWith("```")) break;

        code.push(current);
        i += 1;
      }

      i += 1;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);

    if (headingMatch?.[1] !== undefined && headingMatch?.[2] !== undefined) {
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length,
        children: parseInline(headingMatch[2]),
      });
      i += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];

      while (i < lines.length) {
        const current = lines[i];

        if (current === undefined || !current.startsWith(">")) break;

        quote.push(current.slice(1).replace(/^ /, ""));
        i += 1;
      }

      blocks.push({ kind: "quote", children: parseInline(quote.join("\n")) });
      continue;
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: Inline[][] = [];

      while (i < lines.length) {
        const current = lines[i];

        if (current === undefined) break;

        const match = /^([-*]|\d+\.)\s+(.*)$/.exec(current);

        if (!match || match[2] === undefined) break;

        items.push(parseInline(match[2]));
        i += 1;
      }

      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];

    while (i < lines.length) {
      const current = lines[i];

      if (
        current === undefined ||
        current.trim() === "" ||
        current.startsWith(">") ||
        current.trimStart().startsWith("```") ||
        /^#{1,6}\s+/.test(current) ||
        /^[-*]\s+/.test(current) ||
        /^\d+\.\s+/.test(current)
      ) {
        break;
      }

      paragraph.push(current);
      i += 1;
    }

    blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}
