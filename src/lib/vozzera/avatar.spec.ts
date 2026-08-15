import { describe, expect, it } from "vitest";

import { initials } from "./avatar";

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
