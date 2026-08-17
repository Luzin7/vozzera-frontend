import { describe, expect, it } from "vitest";

import { registrationEmailErrorFor } from "@/lib/vozzera/auth-validation";

describe("registrationEmailErrorFor", () => {
  it("accepts a valid email", () => {
    expect(registrationEmailErrorFor("pessoa@example.com")).toBeNull();
  });

  it("rejects an empty email", () => {
    expect(registrationEmailErrorFor("  ")).toBe("Informe seu email.");
  });

  it.each(["sem-arroba", "pessoa@", "@example.com", "pessoa@example"])(
    "rejects the invalid email %s",
    (email) => {
      expect(registrationEmailErrorFor(email)).toBe("Informe um email válido.");
    },
  );
});
