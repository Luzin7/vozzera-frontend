import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ChangelogError,
  draftBaseline,
  mergeNext,
  InvalidChangelogFileError,
  normalizeChangelog,
  parseChangelogText,
  selectHighlights,
  releaseNext,
  serializeChangelog,
} from "./changelog-lib.mjs";

const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const CHANGELOG_PATH = "public/changelog.json";

const args = parseArgs(process.argv.slice(2));
try {
  const current = normalizeChangelog(readExistingChangelog());

  if (args.release) {
    const released = releaseNext(current, { version: args.version, now: new Date() });

    save(released);
    console.log(`${CHANGELOG_PATH} atualizado: ${released.releases[0].version} lançada.`);
  } else {
    const pulls = await fetchHighlights(current);
    const next = { items: mergeNext(current, pulls) };

    save({ releases: current.releases, next });
    console.log(`${CHANGELOG_PATH} atualizado: ${next.items.length} destaque(s) em next.`);
  }
} catch (error) {
  if (!(error instanceof ChangelogError)) throw error;

  console.error(`Erro: ${error.message}`);
  process.exit(1);
}

function save(changelog) {
  const payload = serializeChangelog(changelog);

  writeFileSync(resolve(CHANGELOG_PATH), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function fetchHighlights(changelog) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

  if (!token) throw new Error("GITHUB_TOKEN não encontrado.");

  const repo = process.env.GITHUB_REPOSITORY || repoFromRemote();
  const baseline = draftBaseline(changelog);
  const highlights = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pulls = await ghApi(
      `repos/${repo}/pulls?state=closed&base=develop&per_page=${PAGE_SIZE}&page=${page}`,
      token,
    );

    highlights.push(...selectHighlights(pulls, { baseline }));

    if (pulls.length < PAGE_SIZE) return highlights;
  }

  warnPageLimit();

  return highlights;
}

function warnPageLimit() {
  const message = `A busca de PRs atingiu o limite de ${MAX_PAGES * PAGE_SIZE} PRs fechados: destaques mais antigos podem ter ficado de fora do rascunho.`;

  console.log(`::warning title=Limite de PRs::${message}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Limite de PRs\n\n${message}\n`);
  }
}

function parseArgs(argv) {
  const result = { release: false, version: null };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--release") result.release = true;
    if (argv[i] === "--version") {
      result.version = argv[i + 1] || null;
      i += 1;
    }
  }

  return result;
}

function readExistingChangelog() {
  let text;

  try {
    text = readFileSync(resolve(CHANGELOG_PATH), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;

    throw new InvalidChangelogFileError(error.message);
  }

  return parseChangelogText(text);
}

function repoFromRemote() {
  const url = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  const match = /github\.com[:/](.+?)(?:\.git)?$/.exec(url);

  if (!match) throw new Error(`Não consegui identificar o repositório: ${url}`);

  return match[1];
}

async function ghApi(path, token) {
  const url = `https://api.github.com/${path}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${response.statusText} (${url})`);
  }

  return response.json();
}
