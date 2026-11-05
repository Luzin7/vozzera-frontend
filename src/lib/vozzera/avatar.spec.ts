import { describe, expect, it } from "vitest";

import { AVATAR_COLOR_CLASSES, avatarColorClass, initials } from "./avatar";

describe("initials", () => {
  it("takes the first two characters in uppercase", () => {
    expect(initials("luan")).toBe("LU");
    expect(initials("Maria Clara")).toBe("MA");
  });

  it("handles short names and empty input", () => {
    expect(initials("a")).toBe("A");
    expect(initials("")).toBe("");
  });
});

describe("avatarColorClass", () => {
  it("is stable for the same key", () => {
    expect(avatarColorClass("user-1")).toBe(avatarColorClass("user-1"));
  });

  it("only returns known palette classes", () => {
    for (let i = 0; i < 200; i++) {
      expect(AVATAR_COLOR_CLASSES).toContain(avatarColorClass(`user-${i}`));
    }
  });

  it("spreads keys across every palette entry", () => {
    const used = new Set<string>();
    for (let i = 0; i < 200; i++) used.add(avatarColorClass(`user-${i}`));
    expect(used.size).toBe(AVATAR_COLOR_CLASSES.length);
  });

  it("falls back to a palette class for an empty key", () => {
    expect(AVATAR_COLOR_CLASSES).toContain(avatarColorClass(""));
  });
});
