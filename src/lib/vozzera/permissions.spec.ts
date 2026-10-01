import { describe, expect, it } from "vitest";

import { canManageRooms, canModerateMessages, canSeeRoom } from "@/lib/vozzera/permissions";

describe("canManageRooms", () => {
  it.each(["mod", "admin"] as const)("allows the %s role", (role) => {
    expect(canManageRooms(role)).toBe(true);
  });

  it("rejects regular and unknown users", () => {
    expect(canManageRooms("user")).toBe(false);
    expect(canManageRooms(null)).toBe(false);
  });
});

describe("canModerateMessages", () => {
  it.each(["mod", "admin"] as const)("allows the %s role", (role) => {
    expect(canModerateMessages(role)).toBe(true);
  });

  it("rejects regular and unknown users", () => {
    expect(canModerateMessages("user")).toBe(false);
    expect(canModerateMessages(null)).toBe(false);
  });
});

describe("canSeeRoom", () => {
  it("lets staff see every room", () => {
    expect(canSeeRoom({ staff_only: true }, "mod")).toBe(true);
    expect(canSeeRoom({ staff_only: true }, "admin")).toBe(true);
  });

  it("hides staff-only rooms from regular users", () => {
    expect(canSeeRoom({ staff_only: true }, "user")).toBe(false);
    expect(canSeeRoom({ staff_only: true }, null)).toBe(false);
  });

  it("shows public rooms to everyone", () => {
    expect(canSeeRoom({ staff_only: false }, "user")).toBe(true);
    expect(canSeeRoom({ staff_only: false }, null)).toBe(true);
  });
});
