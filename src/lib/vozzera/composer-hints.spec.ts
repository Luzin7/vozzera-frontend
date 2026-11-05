import { describe, expect, it } from "vitest";

import { shouldShowCharCounter, shouldShowSendHint } from "./composer-hints";

describe("shouldShowSendHint", () => {
  it("shows only while focused and empty", () => {
    expect(shouldShowSendHint({ focused: true, empty: true })).toBe(true);
    expect(shouldShowSendHint({ focused: false, empty: true })).toBe(false);
    expect(shouldShowSendHint({ focused: true, empty: false })).toBe(false);
    expect(shouldShowSendHint({ focused: false, empty: false })).toBe(false);
  });
});

describe("shouldShowCharCounter", () => {
  it("hides up to 90% of the limit", () => {
    expect(shouldShowCharCounter(0, 1000)).toBe(false);
    expect(shouldShowCharCounter(900, 1000)).toBe(false);
  });

  it("shows above 90% of the limit", () => {
    expect(shouldShowCharCounter(901, 1000)).toBe(true);
    expect(shouldShowCharCounter(1000, 1000)).toBe(true);
  });
});
