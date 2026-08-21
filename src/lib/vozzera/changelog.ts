import { z } from "zod";

export const SEEN_RELEASE_KEY = "vozzera:last-seen-release";

export const changelogSchema = z.object({
  version: z.string(),
  releasedAt: z.string().optional(),
  items: z.array(
    z.object({
      title: z.string(),
      kind: z.string().optional(),
      pr: z.number().optional(),
      summary: z.string().optional(),
    }),
  ),
});

export type Changelog = z.infer<typeof changelogSchema>;
export type ChangelogItem = Changelog["items"][number];

export type ChangelogStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readSeenRelease(storage: ChangelogStorage | null): string | null {
  if (storage === null) return null;
  return storage.getItem(SEEN_RELEASE_KEY);
}

export function writeSeenRelease(storage: ChangelogStorage | null, version: string): void {
  if (storage === null) return;
  storage.setItem(SEEN_RELEASE_KEY, version);
}

export function shouldShowChangelog(changelog: Changelog | null, seen: string | null): boolean {
  if (changelog === null) return false;
  if (changelog.items.length === 0) return false;
  return changelog.version !== seen;
}
