import { readFile, writeFile } from "node:fs/promises";
import { analyzePackageJsonPath } from "./analyze.js";
import { loadPackageContext } from "./context.js";
import type { FixResult, Issue, IssueFixResult, PatchMetadata } from "./issue.js";
import { dependencySections, isRecord, normalizePackageJson, type PackageJson } from "./package-json.js";
import { rewritePackageJson } from "../formatting/rewrite-json.js";

export interface PackageFixResult extends FixResult {
  rewrittenJson?: string;
}

const decodePointerSegment = (segment: string): string => segment.replace(/~1/g, "/").replace(/~0/g, "~");

const setPath = (target: PackageJson, pointer: string, value: unknown): void => {
  if (pointer === "/") {
    return;
  }

  const segments = pointer.split("/").slice(1).map(decodePointerSegment);
  let current: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!isRecord(next)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1) as string] = value;
};

const removePath = (target: PackageJson, pointer: string): void => {
  const segments = pointer.split("/").slice(1).map(decodePointerSegment);
  let current: Record<string, unknown> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = current[segment];
    if (!isRecord(next)) {
      return;
    }
    current = next;
  }
  delete current[segments.at(-1) as string];
};

const applyPatch = (packageJson: PackageJson, patch: PatchMetadata): void => {
  if (patch.path === "/" && patch.operation === "replace" && isRecord(patch.value)) {
    for (const key of Object.keys(packageJson)) {
      delete packageJson[key];
    }
    Object.assign(packageJson, normalizePackageJson(patch.value));
    return;
  }

  if (patch.operation === "remove") {
    removePath(packageJson, patch.path);
    return;
  }

  setPath(packageJson, patch.path, patch.value);
};

const applyKnownSafeFixes = (packageJson: PackageJson, issues: Issue[]): IssueFixResult[] => {
  const results: IssueFixResult[] = [];

  for (const issue of issues) {
    if (issue.fix.classification !== "safe") {
      results.push({
        issueId: issue.id,
        classification: issue.fix.classification,
        status: "skipped",
        message: "Not applied automatically because this fix needs review or manual input."
      });
      continue;
    }

    const patches = issue.fix.patches ?? [];
    if (patches.length === 0 && issue.id === "top-level-sort-required") {
      results.push({
        issueId: issue.id,
        classification: "safe",
        status: "applied",
        patches: [{ operation: "replace", path: "/", reason: "Top-level fields are rewritten in conventional order during formatting" }],
        message: issue.fix.description
      });
      continue;
    }

    for (const patch of patches) {
      applyPatch(packageJson, patch);
    }
    results.push({
      issueId: issue.id,
      classification: "safe",
      status: patches.length > 0 ? "applied" : "not-applicable",
      patches,
      message: patches.length > 0 ? issue.fix.description : "No patch metadata was attached."
    });
  }

  return results;
};

const runFix = async (pathArg: string | undefined, write: boolean): Promise<PackageFixResult> => {
  const report = await analyzePackageJsonPath(pathArg);
  const context = await loadPackageContext(pathArg);

  if (!context.packageJson) {
    return {
      filePath: report.filePath,
      appliedAt: new Date().toISOString(),
      projectTypeGuesses: report.projectTypeGuesses,
      packageManager: report.packageManager,
      results: report.issues.map((issue) => ({
        issueId: issue.id,
        classification: issue.fix.classification,
        status: "failed",
        message: issue.message
      }))
    };
  }

  const mutable = normalizePackageJson(JSON.parse(await readFile(report.filePath, "utf8")));
  const results = applyKnownSafeFixes(mutable, report.issues);
  const rewrittenJson = rewritePackageJson(mutable);

  if (write && rewrittenJson !== context.raw) {
    await writeFile(report.filePath, rewrittenJson);
  }

  return {
    filePath: report.filePath,
    appliedAt: new Date().toISOString(),
    projectTypeGuesses: report.projectTypeGuesses,
    packageManager: report.packageManager,
    results: write
      ? results
      : results.map((result) => result.status === "applied" ? { ...result, status: "skipped", message: "Preview only; rerun with --write to apply." } : result),
    rewrittenJson
  };
};

export const previewSafeFixes = (pathArg?: string): Promise<PackageFixResult> => runFix(pathArg, false);

export const applySafeFixes = (pathArg?: string): Promise<PackageFixResult> => runFix(pathArg, true);
