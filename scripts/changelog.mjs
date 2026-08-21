import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const HIGHLIGHT_LABEL = "destaque";
const MAX_ITEMS = 8;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

const args = parseArgs(process.argv.slice(2));

const repo = process.env.GITHUB_REPOSITORY ?? repoFromRemote();
const tokenHeader = GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {};
const acceptHeader = { Accept: "application/vnd.github.v3+json" };
const defaultHeaders = { ...acceptHeader, ...tokenHeader };

const release = await ghApiOrNull(`repos/${repo}/releases/latest`);

let baseline = null;
let lastTag = null;

if (release) {
  baseline = new Date(release.published_at);
  lastTag = release.tag_name;
} else {
  const tags = await ghApi(`repos/${repo}/tags?per_page=1`);

  if (tags.length > 0) {
    lastTag = tags[0].name;
    const commit = await ghApiOrNull(`repos/${repo}/commits/${tags[0].name}`);

    if (commit) baseline = new Date(commit.commit.author.date);
  }
}

const highlights = [];

for (let page = 1; page <= 3; page += 1) {
  const pulls = await ghApi(`repos/${repo}/pulls?state=closed&per_page=100&page=${page}`);

  if (pulls.length === 0) break;

  for (const pull of pulls) {
    if (pull.merged_at === null) continue;
    if (!pull.labels.some((label) => label.name === HIGHLIGHT_LABEL)) continue;
    if (baseline !== null && new Date(pull.merged_at) <= baseline) continue;

    highlights.push(pull);
  }

  if (highlights.length >= MAX_ITEMS) break;
}

highlights.sort(
  (left, right) => new Date(right.merged_at).getTime() - new Date(left.merged_at).getTime(),
);

const existingSummaries = readExistingSummaries();
const items = highlights.slice(0, MAX_ITEMS).map((pull) => ({
  title: pull.title,
  kind: kindFromTitle(pull.title),
  pr: pull.number,
  summary: extractSummary(pull.body) ?? existingSummaries[pull.number] ?? "",
}));

const version = args.version ?? nextVersion(items, lastTag);

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
  const parsed = { version: null };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--version") {
      parsed.version = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function repoFromRemote() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  const match = /github\.com[:/](.+?)\.git$/.exec(url);

  if (!match) throw new Error(`Não consegui identificar o repo em: ${url}`);

  return match[1];
}

async function ghApi(path) {
  const url = `https://api.github.com/${path}`;
  const response = await fetch(url, { headers: defaultHeaders });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} em ${url}: ${response.statusText}`);
  }

  return response.json();
}

async function ghApiOrNull(path) {
  try {
    return await ghApi(path);
  } catch {
    return null;
  }
}

function nextVersion(items, lastTag) {
  if (items.length === 0) return lastTag ?? "v1.0.0";
  if (items.some((item) => isMinorKind(item.kind))) return bumpMinor(lastTag) ?? "v1.0.0";
  return bumpPatch(lastTag) ?? "v1.0.0";
}

function isMinorKind(kind) {
  if (kind === undefined) return true;
  return kind.startsWith("feat");
}

function bumpPatch(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);

  if (!match) return null;

  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function bumpMinor(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);

  if (!match) return null;

  return `v${match[1]}.${Number(match[2]) + 1}.0`;
}

function extractSummary(body) {
  if (!body) return null;

  const match = body.match(/^## Resumo\s*\n\n([\s\S]*?)(?:\n## |$)/m);

  return match ? match[1].trim() : null;
}

function readExistingSummaries() {
  try {
    const current = JSON.parse(readFileSync(resolve("public/changelog.json"), "utf8"));

    return Object.fromEntries(
      (current.items ?? []).filter((item) => item.summary).map((item) => [item.pr, item.summary]),
    );
  } catch {
    return {};
  }
}

function kindFromTitle(title) {
  const match = /^([a-zA-Z]+)(\([^)]*\))?[:/]/.exec(title);

  return match ? match[1].toLowerCase() : undefined;
}
