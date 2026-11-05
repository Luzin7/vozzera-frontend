import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { findMissingSummaries, normalizeChangelog } from "./changelog-lib.mjs";

const changelog = normalizeChangelog(
  JSON.parse(readFileSync(resolve("public/changelog.json"), "utf8")),
);
const missing = findMissingSummaries(changelog.next.items);

if (missing.length === 0) {
  console.log("Todos os destaques de next têm summary.");
  process.exit(0);
}

const lines = missing.map((item) => `- PR #${item.pr}: ${item.title}`);
const message = `${missing.length} destaque(s) de next sem summary (obrigatório só na hora do release):\n${lines.join("\n")}`;

console.log(`::warning title=Patchnote pendente::${message.replaceAll("\n", "%0A")}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Patchnote pendente\n\n${message}\n`);
}
