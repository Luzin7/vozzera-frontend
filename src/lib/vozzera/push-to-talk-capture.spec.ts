import { describe, expect, it } from "vitest";

import { reducePushToTalkCapture } from "./push-to-talk-capture";

describe("reducePushToTalkCapture", () => {
  it("starts capturing", () => {
    expect(reducePushToTalkCapture(false, { type: "start" })).toEqual({ capturing: true });
  });

  it("stops capturing on blur", () => {
    expect(reducePushToTalkCapture(true, { type: "blur" })).toEqual({ capturing: false });
  });

  it("stops capturing on Escape without binding", () => {
    expect(reducePushToTalkCapture(true, { type: "key", code: "Escape" })).toEqual({
      capturing: false,
    });
  });

  it("binds the pressed key and stops capturing", () => {
    expect(reducePushToTalkCapture(true, { type: "key", code: "KeyV" })).toEqual({
      capturing: false,
      boundCode: "KeyV",
    });
  });

  it("ignores keys when not capturing", () => {
    expect(reducePushToTalkCapture(false, { type: "key", code: "KeyV" })).toEqual({
      capturing: false,
    });
  });
});
