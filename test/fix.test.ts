import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applySafeFixes, previewSafeFixes } from "../src/core/fix.js";

let tempDirs: string[] = [];

async function makeTempPackage(packageJson: unknown, extraFiles: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "fmpj-"));
  tempDirs.push(dir);
  const packagePath = join(dir, "package.json");
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  await Promise.all(Object.entries(extraFiles).map(([name, contents]) => writeFile(join(dir, name), contents)));
  return packagePath;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

describe("safe fixes", () => {
  it("previews safe fixes without writing", async () => {
    const packagePath = await makeTempPackage(
      {
        name: "preview",
        version: "1.0.0",
        dependencies: { zod: "^3.0.0", react: "^19.0.0" }
      },
      { "package-lock.json": "{\"lockfileVersion\": 3}\n" }
    );

    const result = await previewSafeFixes(packagePath);
    const current = await readFile(packagePath, "utf8");

    expect(result.results.some((item) => item.status === "applied")).toBe(false);
    expect(result.rewrittenJson).toContain('"packageManager": "npm@9.0.0"');
    expect(current).not.toContain("packageManager");
  });

  it("writes only safe fixes and keeps review fixes as skipped", async () => {
    const packagePath = await makeTempPackage(
      {
        name: "write",
        version: "1.0.0",
        main: "./dist/index.js",
        dependencies: { zod: "^3.0.0", react: "^19.0.0", typescript: "^5.7.2" },
        devDependencies: { react: "^19.0.0" },
        scripts: { "check-types": "tsc --noEmit" }
      },
      { "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" }
    );

    const result = await applySafeFixes(packagePath);
    const updated = JSON.parse(await readFile(packagePath, "utf8"));

    expect(updated.packageManager).toBe("pnpm@9.0.0");
    expect(Object.keys(updated.dependencies)).toEqual(["react", "typescript", "zod"]);
    expect(updated.scripts.typecheck).toBe("tsc --noEmit");
    expect(updated.devDependencies).not.toHaveProperty("react");
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issueId: "tooling-in-production", status: "skipped" })
      ])
    );
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ issueId: "top-level-sort-required", status: "applied" })
      ])
    );
  });
});
