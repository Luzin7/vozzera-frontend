import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HIGHLIGHT_LABEL = "destaque";
const MAX_ITEMS = 8;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const args = parseArgs(process.argv.slice(2));

const repo = process.env.GITHUB_REPOSITORY ?? repoFromRemote();

if (!GITHUB_TOKEN) {
  throw new Error(
    "GITHUB_TOKEN não encontrado. " +
      "No GitHub Actions, configure GITHUB_TOKEN: ${{ github.token }} no env do step.",
  );
}

const tokenHeader = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
};

const defaultHeaders = {
  Accept: "application/vnd.github.v3+json",
  ...tokenHeader,
};

const release = await ghApiOrNull(`repos/${repo}/releases/latest`);

let baseline = null;
let lastTag = null;

if (release) {
  if (release.published_at) {
    baseline = new Date(release.published_at);
  }

  lastTag = release.tag_name;
} else {
  const tags = await ghApiOrNull(`repos/${repo}/tags?per_page=1`);

  if (tags && tags.length > 0) {
    lastTag = tags[0].name;

    const commit = await ghApiOrNull(`repos/${repo}/commits/${tags[0].name}`);

    if (commit?.commit?.author?.date) {
      baseline = new Date(commit.commit.author.date);
    }
  }
}

const highlights = [];

for (let page = 1; page <= 3; page += 1) {
  const pulls = await ghApiOrNull(`repos/${repo}/pulls?state=closed&per_page=100&page=${page}`);

  if (!pulls || pulls.length === 0) {
    break;
  }

  for (const pull of pulls) {
    if (pull.merged_at === null) {
      continue;
    }

    if (!pull.labels?.some((label) => label.name === HIGHLIGHT_LABEL)) {
      continue;
    }

    if (baseline !== null && new Date(pull.merged_at) <= baseline) {
      continue;
    }

    highlights.push(pull);
  }

  if (highlights.length >= MAX_ITEMS) {
    break;
  }
}

highlights.sort(
  (left, right) => new Date(right.merged_at).getTime() - new Date(left.merged_at).getTime(),
);

const existing = readExistingChangelog();

const existingSummaries = existing
  ? Object.fromEntries(
      (existing.items ?? []).filter((item) => item.summary).map((item) => [item.pr, item.summary]),
    )
  : {};

const items = highlights.slice(0, MAX_ITEMS).map((pull) => ({
  title: pull.title,
  kind: kindFromTitle(pull.title),
  pr: pull.number,
  summary: existingSummaries[pull.number] ?? "",
}));

const baseVersion = args.version ?? existing?.version ?? lastTag ?? "v1.0.0";

const samePRs =
  existing &&
  items.length === (existing.items ?? []).length &&
  items.every((item, index) => item.pr === existing.items[index].pr);

const version = samePRs ? existing.version : nextVersion(items, baseVersion);

const payload = {
  version,
  releasedAt: new Date().toISOString().slice(0, 10),
  items,
};

writeFileSync(resolve("public/changelog.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

process.stdout.write(
  `public/changelog.json atualizado: ${version} com ${items.length} destaque(s).\n`,
);

function parseArgs(argv) {
  const parsed = {
    version: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--version") {
      parsed.version = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return parsed;
}

function repoFromRemote() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
  }).trim();

  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);

  if (!match) {
    throw new Error(`Não consegui identificar o repositório GitHub em: ${url}`);
  }

  return match[1];
}

async function ghApi(path) {
  const url = `https://api.github.com/${path}`;

  const response = await fetch(url, {
    headers: defaultHeaders,
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} em ${url}: ${response.statusText}`);
  }

  return response.json();
}

async function ghApiOrNull(path) {
  try {
    return await ghApi(path);
  } catch (error) {
    console.warn(
      `Aviso: falha ao consultar GitHub API em ${path}:`,
      error instanceof Error ? error.message : error,
    );

    return null;
  }
}

function nextVersion(items, base) {
  if (items.length === 0) {
    return bumpPatch(base) ?? "v1.0.0";
  }

  if (items.some((item) => isMinorKind(item.kind))) {
    return bumpMinor(base) ?? "v1.0.0";
  }

  return bumpPatch(base) ?? "v1.0.0";
}

function isMinorKind(kind) {
  if (kind === undefined) {
    return true;
  }

  return kind.startsWith("feat");
}

function bumpPatch(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);

  if (!match) {
    return null;
  }

  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function bumpMinor(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);

  if (!match) {
    return null;
  }

  return `v${match[1]}.${Number(match[2]) + 1}.0`;
}

function readExistingChangelog() {
  try {
    return JSON.parse(readFileSync(resolve("public/changelog.json"), "utf8"));
  } catch {
    return null;
  }
}

function kindFromTitle(title) {
  const match = /^([a-zA-Z]+)(\([^)]*\))?[:/]/.exec(title);

  return match ? match[1].toLowerCase() : undefined;
}
