import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HIGHLIGHT_LABEL = "destaque";
const MAX_ITEMS = 8;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN não encontrado.");
}

const args = parseArgs(process.argv.slice(2));
const repo = process.env.GITHUB_REPOSITORY || repoFromRemote();

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

const existing = readExistingChangelog();

let baseline = null;
let lastTag = null;

const release = await ghApiOrNull(`repos/${repo}/releases/latest`);

if (release) {
  lastTag = release.tag_name;

  if (release.published_at) {
    baseline = new Date(release.published_at);
  }
}

if (!baseline && existing?.releasedAt) {
  baseline = new Date(`${existing.releasedAt}T00:00:00Z`);
}

const highlights = [];

for (let page = 1; page <= 3; page += 1) {
  const pulls = await ghApi(`repos/${repo}/pulls?state=closed&per_page=100&page=${page}`);

  if (!pulls.length) {
    break;
  }

  for (const pull of pulls) {
    if (!pull.merged_at) {
      continue;
    }

    const isHighlight = pull.labels?.some((label) => label.name.toLowerCase() === HIGHLIGHT_LABEL);

    if (!isHighlight) {
      continue;
    }

    if (baseline && new Date(pull.merged_at) <= baseline) {
      continue;
    }

    highlights.push(pull);
  }

  if (highlights.length >= MAX_ITEMS) {
    break;
  }
}

highlights.sort((a, b) => new Date(b.merged_at).getTime() - new Date(a.merged_at).getTime());

const existingSummaries = Object.fromEntries(
  (existing?.items ?? []).filter((item) => item.summary).map((item) => [item.pr, item.summary]),
);

const items = highlights.slice(0, MAX_ITEMS).map((pull) => ({
  title: pull.title,
  kind: kindFromTitle(pull.title),
  pr: pull.number,
  summary: existingSummaries[pull.number] ?? "",
}));

const baseVersion = args.version || existing?.version || lastTag || "v1.0.0";

const version =
  items.length === 0 ? existing?.version || baseVersion : calculateNextVersion(items, baseVersion);

const payload = {
  version,
  releasedAt: new Date().toISOString().slice(0, 10),
  items,
};

writeFileSync(resolve("public/changelog.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`public/changelog.json atualizado: ${version} com ${items.length} destaque(s).`);

function calculateNextVersion(items, base) {
  if (items.some((item) => item.kind === "breaking")) {
    return bumpMajor(base);
  }

  if (items.some((item) => ["feat", "feature"].includes(item.kind))) {
    return bumpMinor(base);
  }

  return bumpPatch(base);
}

function bumpMajor(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return "v1.0.0";
  }

  return `v${Number(match[1]) + 1}.0.0`;
}

function bumpMinor(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return "v1.0.0";
  }

  return `v${match[1]}.${Number(match[2]) + 1}.0`;
}

function bumpPatch(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    return "v1.0.0";
  }

  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function kindFromTitle(title) {
  const match = /^([a-zA-Z]+)(\([^)]*\))?[:/]/.exec(title);

  return match ? match[1].toLowerCase() : "fix";
}

function parseArgs(argv) {
  const result = { version: null };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--version") {
      result.version = argv[i + 1] || null;
      i += 1;
    }
  }

  return result;
}

function readExistingChangelog() {
  try {
    return JSON.parse(readFileSync(resolve("public/changelog.json"), "utf8"));
  } catch {
    return null;
  }
}

function repoFromRemote() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();

  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);

  if (!match) {
    throw new Error(`Não consegui identificar o repositório: ${url}`);
  }

  return match[1];
}

async function ghApi(path) {
  const url = `https://api.github.com/${path}`;

  const response = await fetch(url, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText} (${url})`);
  }

  return response.json();
}

async function ghApiOrNull(path) {
  try {
    return await ghApi(path);
  } catch (error) {
    if (error instanceof Error && error.message.includes("GitHub API 404")) {
      return null;
    }

    throw error;
  }
}
