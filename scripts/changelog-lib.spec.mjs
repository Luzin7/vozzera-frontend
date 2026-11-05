import { describe, expect, it } from "vitest";

import {
  calculateNextVersion,
  DuplicateVersionError,
  findMissingSummaries,
  InvalidChangelogFileError,
  InvalidVersionError,
  kindFromTitle,
  mergeNext,
  MissingSummariesError,
  normalizeChangelog,
  parseChangelogText,
  selectHighlights,
  NothingToReleaseError,
  releaseDate,
  releaseNext,
  serializeChangelog,
} from "./changelog-lib.mjs";

const item = (pr, overrides = {}) => ({
  title: `feat: novidade ${pr}`,
  kind: "feat",
  pr,
  summary: `Resumo ${pr}`,
  ...overrides,
});
const pull = (number, title = `feat: novidade ${number}`) => ({ number, title });
const release = (version, items) => ({ version, releasedAt: "2026-10-13", items });
const NOW = new Date("2026-11-05T12:00:00Z");

describe("kindFromTitle", () => {
  it("reads the conventional commit type", () => {
    expect(kindFromTitle("feat(pwa): algo")).toBe("feat");
  });

  it("falls back to fix", () => {
    expect(kindFromTitle("Ajuste qualquer")).toBe("fix");
  });
});

describe("calculateNextVersion", () => {
  it("bumps major on breaking", () => {
    expect(calculateNextVersion([item(1, { kind: "breaking" })], "v1.2.3")).toBe("v2.0.0");
  });

  it("bumps minor on feat", () => {
    expect(calculateNextVersion([item(1)], "v1.2.3")).toBe("v1.3.0");
  });

  it("bumps patch otherwise", () => {
    expect(calculateNextVersion([item(1, { kind: "fix" })], "v1.2.3")).toBe("v1.2.4");
  });

  it("restarts from v1.0.0 on an unparseable base", () => {
    expect(calculateNextVersion([item(1)], "abc")).toBe("v1.0.0");
  });
});

describe("releaseDate", () => {
  it("uses the Sao Paulo calendar day, not UTC", () => {
    expect(releaseDate(new Date("2026-11-06T01:30:00Z"))).toBe("2026-11-05");
  });
});

describe("normalizeChangelog", () => {
  it("lifts the legacy top-level shape into releases", () => {
    const normalized = normalizeChangelog({
      version: "v1.0.0",
      releasedAt: "2026-01-01",
      items: [item(1)],
    });

    expect(normalized.releases).toEqual([
      { version: "v1.0.0", releasedAt: "2026-01-01", items: [item(1)] },
    ]);
  });

  it("keeps releases and next as they are", () => {
    const releases = [release("v1.1.0", [item(2)])];
    const normalized = normalizeChangelog({
      version: "v1.1.0",
      items: [item(2)],
      releases,
      next: { items: [item(3)] },
    });

    expect(normalized).toEqual({ releases, next: { items: [item(3)] } });
  });

  it("handles a missing file", () => {
    expect(normalizeChangelog(null)).toEqual({ releases: [], next: { items: [] } });
  });
});

describe("mergeNext", () => {
  it("never drops existing summaries of next", () => {
    const changelog = { releases: [], next: { items: [item(5, { summary: "Texto escrito" })] } };

    const items = mergeNext(changelog, [pull(5, "feat: titulo novo")]);

    expect(items).toEqual([item(5, { title: "feat: titulo novo", summary: "Texto escrito" })]);
  });

  it("keeps next items that fell out of the fetched window", () => {
    const changelog = { releases: [], next: { items: [item(5)] } };

    expect(mergeNext(changelog, [pull(6)]).map((entry) => entry.pr)).toEqual([6, 5]);
  });

  it("adds new highlights with an empty summary", () => {
    const items = mergeNext({ releases: [], next: { items: [] } }, [pull(7)]);

    expect(items).toEqual([item(7, { summary: "" })]);
  });

  it("does not re-add PRs already released", () => {
    const changelog = { releases: [release("v1.0.0", [item(1)])], next: { items: [] } };

    expect(mergeNext(changelog, [pull(1)])).toEqual([]);
  });

  it("is idempotent when run twice", () => {
    const changelog = { releases: [], next: { items: [] } };
    const once = mergeNext(changelog, [pull(7), pull(8)]);
    const twice = mergeNext({ releases: [], next: { items: once } }, [pull(7), pull(8)]);

    expect(twice).toEqual(once);
  });
});

describe("findMissingSummaries", () => {
  it("flags empty and blank summaries", () => {
    const items = [item(1, { summary: "" }), item(2, { summary: "  " }), item(3)];

    expect(findMissingSummaries(items).map((entry) => entry.pr)).toEqual([1, 2]);
  });
});

describe("releaseNext", () => {
  const base = { releases: [release("v1.2.0", [item(1)])], next: { items: [item(2)] } };

  it("moves next into a new releases[0] and clears next", () => {
    const released = releaseNext(base, { version: null, now: NOW });

    expect(released.releases.map((entry) => entry.version)).toEqual(["v1.3.0", "v1.2.0"]);
    expect(released.releases[0]).toEqual({
      version: "v1.3.0",
      releasedAt: "2026-11-05",
      items: [item(2)],
    });
    expect(released.next).toEqual({ items: [] });
  });

  it("honours an explicit version", () => {
    expect(releaseNext(base, { version: "v2.0.0", now: NOW }).releases[0].version).toBe("v2.0.0");
  });

  it("rejects a malformed version", () => {
    expect(() => releaseNext(base, { version: "1.x; rm -rf", now: NOW })).toThrow(
      InvalidVersionError,
    );
  });

  it("rejects an already released version", () => {
    expect(() => releaseNext(base, { version: "v1.2.0", now: NOW })).toThrow(DuplicateVersionError);
  });

  it("fails when next is empty", () => {
    expect(() =>
      releaseNext({ ...base, next: { items: [] } }, { version: null, now: NOW }),
    ).toThrow(NothingToReleaseError);
  });

  it("fails when any next item has no summary", () => {
    const draft = { ...base, next: { items: [item(2), item(3, { summary: "" })] } };

    expect(() => releaseNext(draft, { version: null, now: NOW })).toThrow(MissingSummariesError);
  });

  it("does not mutate the input", () => {
    const snapshot = structuredClone(base);
    releaseNext(base, { version: null, now: NOW });

    expect(base).toEqual(snapshot);
  });
});

describe("serializeChangelog", () => {
  it("keeps the legacy top-level fields equal to releases[0]", () => {
    const releases = [release("v1.3.0", [item(2)]), release("v1.2.0", [item(1)])];

    const payload = serializeChangelog({ releases, next: { items: [] } });

    expect(payload).toMatchObject({
      version: "v1.3.0",
      releasedAt: "2026-10-13",
      items: [item(2)],
      releases,
    });
  });
});

describe("parseChangelogText", () => {
  it("returns null for a missing file", () => {
    expect(parseChangelogText(null)).toBeNull();
  });

  it("parses a valid file", () => {
    const raw = { version: "v1.0.0", items: [] };

    expect(parseChangelogText(JSON.stringify(raw))).toEqual(raw);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseChangelogText('{ "version": "v1.0.0", ')).toThrow(InvalidChangelogFileError);
  });

  it("rejects a file with the wrong shape", () => {
    expect(() => parseChangelogText('{"version":1,"items":[]}')).toThrow(InvalidChangelogFileError);
    expect(() =>
      parseChangelogText('{"version":"v1.0.0","items":[],"releases":[{"items":[]}]}'),
    ).toThrow(InvalidChangelogFileError);
    expect(() => parseChangelogText("[]")).toThrow(InvalidChangelogFileError);
  });

  it("explains the problem in one pt-BR line", () => {
    expect(() => parseChangelogText("{")).toThrow(/^public\/changelog\.json inválido: /);
  });
});

describe("selectHighlights", () => {
  const merged = (number, overrides = {}) => ({
    number,
    title: "feat: x",
    merged_at: "2026-11-01T10:00:00Z",
    labels: [{ name: "Destaque" }],
    base: { ref: "develop" },
    ...overrides,
  });

  it("keeps merged, labeled PRs into develop", () => {
    expect(selectHighlights([merged(1)], { baseline: null }).map((p) => p.number)).toEqual([1]);
  });

  it("ignores PRs merged into another base branch", () => {
    const pulls = [merged(1, { base: { ref: "main" } }), merged(2, { base: { ref: "feat/x" } })];

    expect(selectHighlights(pulls, { baseline: null })).toEqual([]);
  });

  it("ignores unmerged, unlabeled and pre-baseline PRs", () => {
    const pulls = [
      merged(1, { merged_at: null }),
      merged(2, { labels: [] }),
      merged(3, { merged_at: "2026-10-01T00:00:00Z" }),
    ];

    expect(selectHighlights(pulls, { baseline: new Date("2026-10-13T00:00:00Z") })).toEqual([]);
  });
});
