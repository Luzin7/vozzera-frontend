import { describe, expect, it } from "vitest";

import { screenShareErrorMessageFor } from "@/lib/vozzera/screen-share-errors";

function domException(name: string, message = ""): DOMException {
  return new DOMException(message, name);
}

describe("screenShareErrorMessageFor", () => {
  it("stays silent when the user cancels the picker", () => {
    expect(screenShareErrorMessageFor(domException("NotAllowedError", "Permission denied"))).toBe(
      null,
    );
  });

  it("explains how to release the macOS screen recording permission", () => {
    expect(
      screenShareErrorMessageFor(domException("NotAllowedError", "Permission denied by system")),
    ).toContain("macOS");
  });

  it("asks for another window when the source is unreadable", () => {
    expect(screenShareErrorMessageFor(domException("NotReadableError"))).toContain("outra janela");
    expect(screenShareErrorMessageFor(domException("AbortError"))).toContain("outra janela");
  });

  it("reports an unsupported browser", () => {
    expect(screenShareErrorMessageFor(domException("TypeError"))).toContain(
      "não permite compartilhar",
    );
    expect(
      screenShareErrorMessageFor(new TypeError("getDisplayMedia is not a function")),
    ).toContain("não permite compartilhar");
  });

  it("falls back to a generic message for anything else", () => {
    expect(screenShareErrorMessageFor(new Error("boom"))).toBe(
      "Não consegui começar a transmissão.",
    );
    expect(screenShareErrorMessageFor(domException("NotAllowedError"))).toBe(
      "Não consegui começar a transmissão.",
    );
  });
});
