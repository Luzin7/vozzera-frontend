import { describe, expect, it } from "vitest";

import { formatCallDuration } from "./call-duration";

describe("formatCallDuration", () => {
  it.each([
    [0, "00:00"],
    [59_000, "00:59"],
    [60_000, "01:00"],
    [3_599_000, "59:59"],
    [3_600_000, "1:00:00"],
    [3_661_000, "1:01:01"],
    [999, "00:00"],
    [-5_000, "00:00"],
    [Number.NaN, "00:00"],
    [Number.POSITIVE_INFINITY, "00:00"],
  ])("formats %s ms as %s", (ms, expected) => {
    expect(formatCallDuration(ms)).toBe(expected);
  });
});
