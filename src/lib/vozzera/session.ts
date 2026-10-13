import { isCancelledError } from "@tanstack/react-query";

import { isUnauthorized } from "@/lib/vozzera/api";

export function isSessionRejected(error: unknown): boolean {
  return isUnauthorized(error) || isCancelledError(error);
}
