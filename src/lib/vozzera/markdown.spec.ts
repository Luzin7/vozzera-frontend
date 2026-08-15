import { describe, expect, it } from "vitest";

import { parseBlocks, parseInline } from "./markdown";

describe("parseInline", () => {
  it("keeps plain text as a single text node", () => {
    expect(parseInline("oi tudo bem")).toEqual([{ kind: "text", text: "oi tudo bem" }]);
  });

  it("parses bold", () => {
    expect(parseInline("**oi**")).toEqual([
      { kind: "bold", children: [{ kind: "text", text: "oi" }] },
    ]);
  });

  it("parses italic", () => {
    expect(parseInline("*oi*")).toEqual([
      { kind: "italic", children: [{ kind: "text", text: "oi" }] },
    ]);
  });

  it("parses inline code", () => {
    expect(parseInline("`oi`")).toEqual([{ kind: "code", text: "oi" }]);
  });

  it("parses a safe link", () => {
    expect(parseInline("[vozzera](https://vozzera.app)")).toEqual([
      { kind: "link", url: "https://vozzera.app", children: [{ kind: "text", text: "vozzera" }] },
    ]);
  });

  it("does not turn javascript: urls into links", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { kind: "text", text: "[x](javascript:alert(1))" },
    ]);
  });

  it("renders raw html tags as plain text", () => {
    expect(parseInline("<script>alert(1)</script>")).toEqual([
      { kind: "text", text: "<script>alert(1)</script>" },
    ]);
  });

  it("keeps unbalanced markers as text", () => {
    expect(parseInline("**oi")).toEqual([{ kind: "text", text: "**oi" }]);
  });
});

describe("parseBlocks", () => {
  it("parses a paragraph", () => {
    expect(parseBlocks("oi")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "oi" }] },
    ]);
  });

  it("parses a fenced code block", () => {
    expect(parseBlocks("```\nconst a = 1\n```")).toEqual([{ kind: "code", text: "const a = 1" }]);
  });

  it("parses a blockquote", () => {
    expect(parseBlocks("> citado")).toEqual([
      { kind: "quote", children: [{ kind: "text", text: "citado" }] },
    ]);
  });

  it("parses an unordered list", () => {
    expect(parseBlocks("- um\n- dois")).toEqual([
      {
        kind: "list",
        ordered: false,
        items: [[{ kind: "text", text: "um" }], [{ kind: "text", text: "dois" }]],
      },
    ]);
  });

  it("parses an ordered list", () => {
    expect(parseBlocks("1. um\n2. dois")).toEqual([
      {
        kind: "list",
        ordered: true,
        items: [[{ kind: "text", text: "um" }], [{ kind: "text", text: "dois" }]],
      },
    ]);
  });

  it("splits paragraphs on blank lines", () => {
    expect(parseBlocks("um\n\ndois")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "um" }] },
      { kind: "paragraph", children: [{ kind: "text", text: "dois" }] },
    ]);
  });
});
