import { CancelledError } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/vozzera/api";
import { isSessionRejected } from "@/lib/vozzera/session";

describe("isSessionRejected", () => {
  it("recognizes a 401 from the server", () => {
    expect(isSessionRejected(new ApiError(401, "Token inválido"))).toBe(true);
  });

  it("recognizes queries cancelled because the session ended", () => {
    expect(isSessionRejected(new CancelledError())).toBe(true);
  });

  it("does not treat server or network failures as a rejected session", () => {
    expect(isSessionRejected(new ApiError(500, "Erro ao listar salas"))).toBe(false);
    expect(isSessionRejected(new TypeError("Failed to fetch"))).toBe(false);
  });
});
