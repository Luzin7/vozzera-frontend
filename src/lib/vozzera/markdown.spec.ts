import { describe, expect, it } from "vitest";

import { matchBareUrl, parseBlocks, parseInline } from "./markdown";
import type { Inline } from "./markdown";

function link(url: string): Inline {
  return { kind: "link", url, children: [{ kind: "text", text: url }] };
}

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

  it("parses a room mention", () => {
    expect(parseInline("#sala-geral")).toEqual([{ kind: "room", roomName: "sala-geral" }]);
  });

  it("parses a room mention in the middle of text", () => {
    expect(parseInline("vamos para #sala-geral agora")).toEqual([
      { kind: "text", text: "vamos para " },
      { kind: "room", roomName: "sala-geral" },
      { kind: "text", text: " agora" },
    ]);
  });

  it("does not parse # when attached to a word without space before", () => {
    expect(parseInline("abc#sala")).toEqual([{ kind: "text", text: "abc#sala" }]);
  });

  it("does not parse # when no valid room name follows", () => {
    expect(parseInline("#")).toEqual([{ kind: "text", text: "#" }]);
  });
});

describe("parseInline bare urls", () => {
  it("links a url at the start of the message", () => {
    expect(parseInline("https://vozzera.app")).toEqual([link("https://vozzera.app")]);
  });

  it("links a url in the middle of the message", () => {
    expect(parseInline("veja https://vozzera.app aqui")).toEqual([
      { kind: "text", text: "veja " },
      link("https://vozzera.app"),
      { kind: "text", text: " aqui" },
    ]);
  });

  it("links a url at the end of the message", () => {
    expect(parseInline("acesso https://vozzera.app")).toEqual([
      { kind: "text", text: "acesso " },
      link("https://vozzera.app"),
    ]);
  });

  it("links an uppercase scheme and host", () => {
    expect(parseInline("HTTPS://VOZZERA.APP")).toEqual([link("HTTPS://VOZZERA.APP")]);
  });

  it("links a url wrapped in bold without swallowing the markers", () => {
    expect(parseInline("**https://vozzera.app**")).toEqual([
      { kind: "bold", children: [link("https://vozzera.app")] },
    ]);
  });

  it("leaves a trailing dot outside the url", () => {
    expect(parseInline("https://x.com/y.")).toEqual([
      link("https://x.com/y"),
      { kind: "text", text: "." },
    ]);
  });

  it("leaves trailing punctuation outside the url", () => {
    expect(parseInline("https://x.com/y,")).toEqual([
      link("https://x.com/y"),
      { kind: "text", text: "," },
    ]);
    expect(parseInline("https://x.com/y!")).toEqual([
      link("https://x.com/y"),
      { kind: "text", text: "!" },
    ]);
    expect(parseInline("https://x.com/y?")).toEqual([
      link("https://x.com/y"),
      { kind: "text", text: "?" },
    ]);
  });

  it("leaves an external parenthesis outside the url", () => {
    expect(parseInline("(https://x.com/y)")).toEqual([
      { kind: "text", text: "(" },
      link("https://x.com/y"),
      { kind: "text", text: ")" },
    ]);
  });

  it("keeps an internal parenthesis inside the url", () => {
    expect(parseInline("https://en.wikipedia.org/wiki/Foo_(bar)")).toEqual([
      link("https://en.wikipedia.org/wiki/Foo_(bar)"),
    ]);
  });

  it("does not link text without a scheme", () => {
    expect(parseInline("httpfoo")).toEqual([{ kind: "text", text: "httpfoo" }]);
    expect(parseInline("isso é http")).toEqual([{ kind: "text", text: "isso é http" }]);
  });

  it("does not link a url inside inline code", () => {
    expect(parseInline("`https://vozzera.app`")).toEqual([
      { kind: "code", text: "https://vozzera.app" },
    ]);
  });
});

describe("matchBareUrl", () => {
  it("returns null when the text does not start with a url", () => {
    expect(matchBareUrl("vozzera.com")).toBeNull();
    expect(matchBareUrl("veja https://vozzera.app")).toBeNull();
  });

  it("trims trailing punctuation and reports the consumed length", () => {
    expect(matchBareUrl("https://x.com/y.")).toEqual({ url: "https://x.com/y", length: 15 });
  });

  it("keeps balanced parenthesis", () => {
    expect(matchBareUrl("https://en.wikipedia.org/wiki/Foo_(bar)")?.url).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
  });
});

describe("parseBlocks", () => {
  it("parses a paragraph", () => {
    expect(parseBlocks("oi")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "oi" }] },
    ]);
  });

  it("parses a heading", () => {
    expect(parseBlocks("# Titulo")).toEqual([
      { kind: "heading", level: 1, children: [{ kind: "text", text: "Titulo" }] },
    ]);
  });

  it("parses all heading levels", () => {
    expect(parseBlocks("###### Titulo")).toEqual([
      { kind: "heading", level: 6, children: [{ kind: "text", text: "Titulo" }] },
    ]);
  });

  it("parses heading with inline formatting", () => {
    expect(parseBlocks("## **Titulo**")).toEqual([
      {
        kind: "heading",
        level: 2,
        children: [{ kind: "bold", children: [{ kind: "text", text: "Titulo" }] }],
      },
    ]);
  });

  it("parses #room as a room mention, not heading", () => {
    expect(parseBlocks("#semespaco")).toEqual([
      { kind: "paragraph", children: [{ kind: "room", roomName: "semespaco" }] },
    ]);
  });

  it("splits paragraph before a heading", () => {
    expect(parseBlocks("um\n# Titulo")).toEqual([
      { kind: "paragraph", children: [{ kind: "text", text: "um" }] },
      { kind: "heading", level: 1, children: [{ kind: "text", text: "Titulo" }] },
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

  it("does not link a url inside a fenced code block", () => {
    expect(parseBlocks("```\nhttps://vozzera.app\n```")).toEqual([
      { kind: "code", text: "https://vozzera.app" },
    ]);
  });
});
