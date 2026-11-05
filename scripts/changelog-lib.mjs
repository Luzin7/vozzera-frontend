export const RELEASE_TIME_ZONE = "America/Sao_Paulo";
export const DEFAULT_VERSION = "v1.0.0";
const VERSION_PATTERN = /^v(\d+)\.(\d+)\.(\d+)$/;

export class ChangelogError extends Error {}

export class InvalidVersionError extends ChangelogError {
  constructor(version) {
    super(`Versão inválida: "${version}". Use o formato vMAJOR.MINOR.PATCH (ex.: v1.2.0).`);
    this.name = "InvalidVersionError";
  }
}

export class DuplicateVersionError extends ChangelogError {
  constructor(version) {
    super(`A versão ${version} já foi lançada.`);
    this.name = "DuplicateVersionError";
  }
}

export class InvalidChangelogFileError extends ChangelogError {
  constructor(detail) {
    super(`public/changelog.json inválido: ${detail}`);
    this.name = "InvalidChangelogFileError";
  }
}

export class NothingToReleaseError extends ChangelogError {
  constructor() {
    super("Nenhum destaque em `next`: não há o que lançar.");
    this.name = "NothingToReleaseError";
  }
}

export class MissingSummariesError extends ChangelogError {
  constructor(items) {
    super(
      `${items.length} destaque(s) sem summary: ${items.map((item) => `#${item.pr}`).join(", ")}. Escreva o patchnote em public/changelog.json (next.items[].summary) antes de lançar.`,
    );
    this.name = "MissingSummariesError";
    this.items = items;
  }
}

export function isValidVersion(version) {
  return VERSION_PATTERN.test(version);
}

export function kindFromTitle(title) {
  const match = /^([a-zA-Z]+)(\([^)]*\))?[:/]/.exec(title);

  return match ? match[1].toLowerCase() : "fix";
}

export function calculateNextVersion(items, base) {
  const match = VERSION_PATTERN.exec(base);

  if (!match) return DEFAULT_VERSION;

  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];

  if (items.some((item) => item.kind === "breaking")) return `v${major + 1}.0.0`;
  if (items.some((item) => ["feat", "feature"].includes(item.kind))) {
    return `v${major}.${minor + 1}.0`;
  }

  return `v${major}.${minor}.${patch + 1}`;
}

export function releaseDate(now, timeZone = RELEASE_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function normalizeChangelog(raw) {
  const releases = raw?.releases ?? [];
  const legacyLatest =
    releases.length === 0 && raw?.version
      ? [{ version: raw.version, releasedAt: raw.releasedAt, items: raw.items ?? [] }]
      : [];

  return {
    releases: [...releases, ...legacyLatest],
    next: { items: raw?.next?.items ?? [] },
  };
}

export function isBlank(text) {
  return typeof text !== "string" || text.trim() === "";
}

export function findMissingSummaries(items) {
  return items.filter((item) => isBlank(item.summary));
}

export function releasedPrs(releases) {
  return new Set(releases.flatMap((release) => release.items.map((item) => item.pr)));
}

export function summariesByPr(changelog) {
  const entries = [...changelog.releases.flatMap((r) => r.items), ...changelog.next.items]
    .filter((item) => !isBlank(item.summary))
    .map((item) => [item.pr, item.summary]);

  return new Map(entries);
}

export function toDraftItem(pull, summaries) {
  return {
    title: pull.title,
    kind: kindFromTitle(pull.title),
    pr: pull.number,
    summary: summaries.get(pull.number) ?? "",
  };
}

export function mergeNext(changelog, pulls) {
  const released = releasedPrs(changelog.releases);
  const summaries = summariesByPr(changelog);
  const known = new Map(changelog.next.items.map((item) => [item.pr, item]));

  for (const pull of pulls) {
    known.set(pull.number, toDraftItem(pull, summaries));
  }

  const items = [...known.values()].filter((item) => !released.has(item.pr));

  return items.sort((a, b) => b.pr - a.pr);
}

export function releaseNext(changelog, { version, now }) {
  if (changelog.next.items.length === 0) throw new NothingToReleaseError();

  const missing = findMissingSummaries(changelog.next.items);

  if (missing.length > 0) throw new MissingSummariesError(missing);

  const base = changelog.releases[0]?.version ?? DEFAULT_VERSION;
  const nextVersion = version || calculateNextVersion(changelog.next.items, base);

  if (!isValidVersion(nextVersion)) throw new InvalidVersionError(nextVersion);

  if (changelog.releases.some((release) => release.version === nextVersion)) {
    throw new DuplicateVersionError(nextVersion);
  }

  return {
    releases: [
      { version: nextVersion, releasedAt: releaseDate(now), items: changelog.next.items },
      ...changelog.releases,
    ],
    next: { items: [] },
  };
}

export function serializeChangelog({ releases, next }) {
  const latest = releases[0];

  return {
    version: latest?.version ?? DEFAULT_VERSION,
    releasedAt: latest?.releasedAt,
    items: latest?.items ?? [],
    next,
    releases,
  };
}

export function draftBaseline(changelog) {
  const releasedAt = changelog.releases[0]?.releasedAt;

  return releasedAt ? new Date(`${releasedAt}T00:00:00Z`) : null;
}

const isString = (value) => typeof value === "string";
const isOptionalString = (value) => value === undefined || isString(value);
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function isValidItem(item) {
  return (
    isObject(item) &&
    isString(item.title) &&
    isOptionalString(item.kind) &&
    isOptionalString(item.summary) &&
    (item.pr === undefined || Number.isInteger(item.pr))
  );
}

const isValidItems = (items) => Array.isArray(items) && items.every(isValidItem);

function isValidRelease(release) {
  return (
    isObject(release) &&
    isString(release.version) &&
    isOptionalString(release.releasedAt) &&
    isValidItems(release.items)
  );
}

function isValidChangelogShape(raw) {
  return (
    isValidRelease(raw) &&
    (raw.releases === undefined ||
      (Array.isArray(raw.releases) && raw.releases.every(isValidRelease))) &&
    (raw.next === undefined || (isObject(raw.next) && isValidItems(raw.next.items)))
  );
}

export function parseChangelogText(text) {
  if (text === null) return null;

  let raw;

  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new InvalidChangelogFileError(error.message);
  }

  if (!isValidChangelogShape(raw)) {
    throw new InvalidChangelogFileError("formato inesperado (version, items, releases ou next).");
  }

  return raw;
}

export function selectHighlights(pulls, { baseline, baseBranch = "develop", label = "destaque" }) {
  return pulls.filter((pull) => {
    if (!pull.merged_at) return false;
    if (pull.base?.ref !== baseBranch) return false;
    if (!pull.labels?.some((entry) => entry.name.toLowerCase() === label)) return false;

    return !baseline || new Date(pull.merged_at) > baseline;
  });
}
