import type { UserRole } from "@/lib/vozzera/types";

export function canManageRooms(role: UserRole | null): boolean {
  return role === "mod" || role === "admin";
}
