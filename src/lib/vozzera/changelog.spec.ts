import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  changelogSchema,
  formatReleaseDate,
  readSeenRelease,
  releasesOf,
  visibleItems,
  SEEN_RELEASE_KEY,
  shouldShowChangelog,
  writeSeenRelease,
} from "./changelog";
import type { Changelog, ChangelogStorage } from "./changelog";

function memoryStorage(): ChangelogStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function changelog(version: string, items = 1): Changelog {
  return {
    version,
    items: Array.from({ length: items }, (_, index) => ({
      title: `Novidade ${index}`,
      pr: index,
      summary: `Resumo ${index}`,
    })),
  };
}

describe("readSeenRelease", () => {
  it("returns null when nothing is stored", () => {
    expect(readSeenRelease(memoryStorage())).toBeNull();
  });

  it("returns the stored version", () => {
    const storage = memoryStorage();
    storage.setItem(SEEN_RELEASE_KEY, "v1.0.0");

    expect(readSeenRelease(storage)).toBe("v1.0.0");
  });

  it("returns null when storage is unavailable", () => {
    expect(readSeenRelease(null)).toBeNull();
  });
});

describe("writeSeenRelease", () => {
  it("stores the version", () => {
    const storage = memoryStorage();
    writeSeenRelease(storage, "v1.1.0");

    expect(storage.getItem(SEEN_RELEASE_KEY)).toBe("v1.1.0");
  });

  it("does nothing when storage is unavailable", () => {
    expect(() => writeSeenRelease(null, "v1.1.0")).not.toThrow();
  });
});

describe("shouldShowChangelog", () => {
  it("hides when there is no changelog", () => {
    expect(shouldShowChangelog(null, null)).toBe(false);
  });

  it("hides when there are no highlights", () => {
    expect(shouldShowChangelog(changelog("v1.0.0", 0), null)).toBe(false);
  });

  it("shows for a release the user has not seen", () => {
    expect(shouldShowChangelog(changelog("v1.0.0"), null)).toBe(true);
  });

  it("hides for a release the user already saw", () => {
    expect(shouldShowChangelog(changelog("v1.0.0"), "v1.0.0")).toBe(false);
  });

  it("shows again for the next release", () => {
    expect(shouldShowChangelog(changelog("v1.1.0"), "v1.0.0")).toBe(true);
  });
});

describe("shouldShowChangelog without summaries", () => {
  it("hides when no item has a summary", () => {
    const raw: Changelog = { version: "v1.0.0", items: [{ title: "fix: x", summary: " " }] };

    expect(shouldShowChangelog(raw, null)).toBe(false);
  });
});

describe("changelogSchema", () => {
  it("accepts the legacy shape", () => {
    const legacy = { version: "v1.0.0", releasedAt: "2026-01-01", items: [{ title: "a" }] };

    expect(changelogSchema.safeParse(legacy).success).toBe(true);
  });

  it("accepts releases and next", () => {
    const next = {
      version: "v1.1.0",
      items: [],
      next: { items: [{ title: "b", pr: 2, summary: "" }] },
      releases: [{ version: "v1.1.0", releasedAt: "2026-02-01", items: [] }],
    };

    expect(changelogSchema.safeParse(next).success).toBe(true);
  });

  it("rejects a release without version", () => {
    const broken = { version: "v1", items: [], releases: [{ items: [] }] };

    expect(changelogSchema.safeParse(broken).success).toBe(false);
  });
});

describe("releasesOf", () => {
  it("wraps the legacy shape as a single release", () => {
    const legacy: Changelog = {
      version: "v1.0.0",
      releasedAt: "2026-01-01",
      items: [{ title: "a" }],
    };

    expect(releasesOf(legacy)).toEqual([
      { version: "v1.0.0", releasedAt: "2026-01-01", items: [{ title: "a" }] },
    ]);
  });

  it("sorts releases newest first by semver", () => {
    const raw: Changelog = {
      version: "v1.10.0",
      items: [],
      releases: [
        { version: "v1.9.0", items: [] },
        { version: "v1.10.0", items: [] },
        { version: "v1.2.0", items: [] },
      ],
    };

    expect(releasesOf(raw).map((release) => release.version)).toEqual([
      "v1.10.0",
      "v1.9.0",
      "v1.2.0",
    ]);
  });
});

describe("visibleItems", () => {
  it("skips items without summary and never exposes titles", () => {
    const items = [
      { title: "feat: cru", summary: "" },
      { title: "fix: cru", summary: "  " },
      { title: "feat: ok", summary: "Texto" },
      { title: "sem campo" },
    ];

    expect(visibleItems(items)).toEqual([{ title: "feat: ok", summary: "Texto" }]);
  });
});

describe("formatReleaseDate", () => {
  it("formats a date-only value in pt-BR regardless of process TZ", () => {
    expect(formatReleaseDate("2026-10-13")).toBe("13 de outubro de 2026");
  });

  it("returns null when the date is missing or invalid", () => {
    expect(formatReleaseDate(undefined)).toBeNull();
    expect(formatReleaseDate("ontem")).toBeNull();
  });
});

describe("public/changelog.json", () => {
  const file = changelogSchema.parse(
    JSON.parse(readFileSync(`${process.cwd()}/public/changelog.json`, "utf8")),
  );

  it("keeps the top-level fields equal to releases[0]", () => {
    const [latest] = file.releases ?? [];

    expect({ version: file.version, releasedAt: file.releasedAt, items: file.items }).toEqual({
      version: latest?.version,
      releasedAt: latest?.releasedAt,
      items: latest?.items,
    });
  });

  it("has a summary on every released item", () => {
    const released = (file.releases ?? []).flatMap((release) => release.items);

    expect(released.filter((entry) => !entry.summary?.trim())).toEqual([]);
  });

  it("has no backticks or known typos in summaries", () => {
    const summaries = (file.releases ?? []).flatMap((release) =>
      release.items.map((entry) => entry.summary ?? ""),
    );

    expect(summaries.filter((text) => text.includes("`") || text.includes("Vozerra"))).toEqual([]);
  });

  it("has a formattable date on every release", () => {
    const dates = (file.releases ?? []).map((release) => formatReleaseDate(release.releasedAt));

    expect(dates.filter((date) => date === null)).toEqual([]);
  });

  it("lists releases newest first without repeated versions", () => {
    const versions = (file.releases ?? []).map((release) => release.version);

    expect(versions).toEqual([...new Set(versions)]);
    expect(releasesOf(file).map((release) => release.version)).toEqual(versions);
  });

  it("keeps the history rebuilt from git", () => {
    const versions = (file.releases ?? []).map((release) => release.version);

    expect(versions).toContain("v1.18.0");
  });
});
