import { CancelledError } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/vozzera/api";
import { sessionRejected } from "@/lib/vozzera/session";

describe("sessionRejected", () => {
  it("recognizes a 401 from the server", () => {
    expect(sessionRejected(new ApiError(401, "Token inválido"))).toBe(true);
  });

  it("recognizes queries cancelled because the session ended", () => {
    expect(sessionRejected(new CancelledError())).toBe(true);
  });

  it("does not treat server or network failures as a rejected session", () => {
    expect(sessionRejected(new ApiError(500, "Erro ao listar salas"))).toBe(false);
    expect(sessionRejected(new TypeError("Failed to fetch"))).toBe(false);
  });
});
