import type { UserRole } from "@/lib/vozzera/types";

function isModOrAdmin(role: UserRole | null): boolean {
  return role === "mod" || role === "admin";
}

export function canManageRooms(role: UserRole | null): boolean {
  return isModOrAdmin(role);
}

export function canModerateMessages(role: UserRole | null): boolean {
  return isModOrAdmin(role);
}
