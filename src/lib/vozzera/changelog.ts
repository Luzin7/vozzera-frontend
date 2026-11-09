import { z } from "zod";

export const SEEN_RELEASE_KEY = "vozzera:last-seen-release";

const RELEASE_TIME_ZONE = "America/Sao_Paulo";
const RELEASE_LOCALE = "pt-BR";
const RELEASE_NOON_UTC = "T12:00:00Z";

const itemSchema = z.object({
  title: z.string(),
  kind: z.string().optional(),
  pr: z.number().optional(),
  summary: z.string().optional(),
});

const releaseSchema = z.object({
  version: z.string(),
  releasedAt: z.string().optional(),
  items: z.array(itemSchema),
});

export const changelogSchema = releaseSchema.extend({
  next: z.object({ items: z.array(itemSchema) }).optional(),
  releases: z.array(releaseSchema).optional(),
});

export type Changelog = z.infer<typeof changelogSchema>;
export type ChangelogItem = z.infer<typeof itemSchema>;
export type ChangelogRelease = z.infer<typeof releaseSchema>;

export class ChangelogLoadError extends Error {
  constructor() {
    super("Não consegui carregar o changelog.");
    this.name = "ChangelogLoadError";
  }
}

const VALID_VERSION = /^v?\d+(\.\d+)*$/;

function isValidVersion(version: string | null): version is string {
  return version !== null && VALID_VERSION.test(version);
}

function versionParts(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersionsDesc(a: string, b: string): number {
  const [left, right] = [versionParts(a), versionParts(b)];
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (right[index] ?? 0) - (left[index] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

export function releasesOf(changelog: Changelog): ChangelogRelease[] {
  const topLevel: ChangelogRelease = {
    version: changelog.version,
    releasedAt: changelog.releasedAt,
    items: changelog.items,
  };
  const listed = changelog.releases ?? [];
  const releases = listed.some((release) => release.version === topLevel.version)
    ? listed
    : [topLevel, ...listed];

  return [...releases].sort((a, b) => compareVersionsDesc(a.version, b.version));
}

export function visibleItems(items: ChangelogItem[]): ChangelogItem[] {
  return items.filter((item) => (item.summary ?? "").trim() !== "");
}

export function formatReleaseDate(releasedAt: string | undefined): string | null {
  if (releasedAt === undefined) return null;

  const date = new Date(`${releasedAt}${RELEASE_NOON_UTC}`);

  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(RELEASE_LOCALE, {
    timeZone: RELEASE_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export type ChangelogStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readSeenRelease(storage: ChangelogStorage | null): string | null {
  if (storage === null) return null;
  return storage.getItem(SEEN_RELEASE_KEY);
}

export function writeSeenRelease(storage: ChangelogStorage | null, version: string): void {
  if (storage === null) return;
  storage.setItem(SEEN_RELEASE_KEY, version);
}

export const MAX_UNSEEN_RELEASES = 5;

function withVisibleItems(release: ChangelogRelease): ChangelogRelease {
  return { ...release, items: visibleItems(release.items) };
}

export function unseenReleases(
  changelog: Changelog | null,
  lastSeenVersion: string | null,
): ChangelogRelease[] {
  if (changelog === null) return [];

  const releases = releasesOf(changelog);
  const newer = isValidVersion(lastSeenVersion)
    ? releases.filter((release) => compareVersionsDesc(release.version, lastSeenVersion) < 0)
    : releases.slice(0, 1);

  return newer
    .map(withVisibleItems)
    .filter((release) => release.items.length > 0)
    .slice(0, MAX_UNSEEN_RELEASES);
}

export function syncSeenRelease(
  storage: ChangelogStorage | null,
  changelog: Changelog | null,
): string | null {
  const seen = readSeenRelease(storage);

  if (changelog === null || seen !== null) return seen;

  const [latest] = unseenReleases(changelog, null);

  if (latest === undefined) return seen;

  writeSeenRelease(storage, latest.version);
  return latest.version;
}

export function unseenReleasesSince(
  changelog: Changelog | null,
  seen: string | null | undefined,
): ChangelogRelease[] {
  if (seen === null || seen === undefined) return [];
  return unseenReleases(changelog, seen);
}

export function shouldShowChangelog(changelog: Changelog | null, seen: string | null): boolean {
  return unseenReleases(changelog, seen).length > 0;
}
