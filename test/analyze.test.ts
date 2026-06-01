import { describe, expect, it } from "vitest";
import { analyzePackageJsonPath } from "../src/core/analyze.js";

const fixture = (name: string) => new URL(`./fixtures/${name}/package.json`, import.meta.url).pathname;

describe("analyzePackageJsonPath", () => {
  it("returns an invalid-json critical issue instead of throwing", async () => {
    const report = await analyzePackageJsonPath(fixture("invalid-json"));

    expect(report.filePath).toContain("invalid-json/package.json");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "invalid-json",
          severity: "critical",
          fix: expect.objectContaining({ classification: "manual" })
        })
      ])
    );
  });

  it("detects project type, package manager, metadata, script, and dependency issues", async () => {
    const report = await analyzePackageJsonPath(fixture("vite-app"));
    const issueIds = report.issues.map((issue) => issue.id);

    expect(report.projectTypeGuesses).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "vite-app" })])
    );
    expect(report.packageManager).toEqual(
      expect.objectContaining({
        name: "pnpm",
        version: "9.0.0",
        versionSource: "lockfile",
        lockfilePath: expect.stringContaining("pnpm-lock.yaml")
      })
    );
    expect(issueIds).toContain("missing-package-manager");
    expect(issueIds).toContain("missing-package-metadata");
    expect(issueIds).toContain("tooling-in-production");
    expect(issueIds).toContain("dependency-sort-required");
    expect(issueIds).toContain("missing-standard-script");
    expect(issueIds).toContain("nonstandard-script-name");
  });

  it("detects library publishing gaps without pretending they are safe fixes", async () => {
    const report = await analyzePackageJsonPath(fixture("library"));
    const issueIds = report.issues.map((issue) => issue.id);

    expect(report.projectTypeGuesses).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "typescript-library" })])
    );
    expect(report.projectTypeGuesses).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "node-cli" })])
    );
    expect(issueIds).not.toContain("missing-bin");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "missing-exports", fix: expect.objectContaining({ classification: "review" }) }),
        expect.objectContaining({ id: "missing-files", fix: expect.objectContaining({ classification: "review" }) })
      ])
    );
  });

  it("detects CLI packages missing bin metadata", async () => {
    const report = await analyzePackageJsonPath(fixture("cli"));

    expect(report.projectTypeGuesses).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "node-cli" })])
    );
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "missing-bin", severity: "warning" })
      ])
    );
  });
});
