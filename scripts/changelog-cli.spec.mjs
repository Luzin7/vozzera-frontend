import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/changelog.mjs");

function workdir(content) {
  const dir = mkdtempSync(join(tmpdir(), "changelog-"));
  mkdirSync(join(dir, "public"));

  if (content !== null) writeFileSync(join(dir, "public/changelog.json"), content);

  return dir;
}

function run(dir, args) {
  return spawnSync("node", [SCRIPT, ...args], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, GITHUB_TOKEN: "x", GITHUB_REPOSITORY: "o/r" },
  });
}

describe("changelog cli", () => {
  it("fails loudly and leaves a malformed file untouched", () => {
    const truncated = '{ "version": "v1.21.0", "items": [ {';
    const dir = workdir(truncated);

    const result = run(dir, []);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("public/changelog.json inválido");
    expect(readFileSync(join(dir, "public/changelog.json"), "utf8")).toBe(truncated);
  });

  it("fails on a malformed file in release mode too", () => {
    const dir = workdir("{");

    expect(run(dir, ["--release"]).status).toBe(1);
  });

  it("starts fresh when the file is missing (release has nothing to ship)", () => {
    const dir = workdir(null);

    const result = run(dir, ["--release"]);

    expect(result.stderr).toContain("não há o que lançar");
    expect(existsSync(join(dir, "public/changelog.json"))).toBe(false);
  });
});
