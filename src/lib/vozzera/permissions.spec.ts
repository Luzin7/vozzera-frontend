import { describe, expect, it } from "vitest";

import { canManageRooms } from "@/lib/vozzera/permissions";

describe("canManageRooms", () => {
  it.each(["mod", "admin"] as const)("allows the %s role", (role) => {
    expect(canManageRooms(role)).toBe(true);
  });

  it("rejects regular and unknown users", () => {
    expect(canManageRooms("user")).toBe(false);
    expect(canManageRooms(null)).toBe(false);
  });
});
