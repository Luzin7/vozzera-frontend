import { describe, expect, it } from "vitest";

import { registrationEmailErrorFor, requiresEmailSetup } from "@/lib/vozzera/auth-validation";

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

describe("requiresEmailSetup", () => {
  it("flags legacy emails", () => {
    expect(requiresEmailSetup("user_abc@legacy.local")).toBe(true);
  });

  it("accepts real emails", () => {
    expect(requiresEmailSetup("pessoa@example.com")).toBe(false);
  });

  it("accepts missing email", () => {
    expect(requiresEmailSetup(null)).toBe(false);
    expect(requiresEmailSetup(undefined)).toBe(false);
  });
});
