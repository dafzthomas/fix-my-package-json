import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { ProjectTypeGuess } from "./issue.js";
import { allDependencies, type PackageJson } from "./package-json.js";
import { fileExists } from "./context.js";

export interface ProjectDetectionContext {
  projectRoot: string;
  packageJson: PackageJson;
}

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const hasDependency = (dependencies: Record<string, string>, name: string): boolean => hasOwn(dependencies, name);

const fileStartsWithShebang = async (path: string): Promise<boolean> => {
  try {
    const contents = await readFile(path, "utf8");
    return contents.startsWith("#!");
  } catch {
    return false;
  }
};

export const detectProjectTypes = async ({
  projectRoot,
  packageJson
}: ProjectDetectionContext): Promise<ProjectTypeGuess[]> => {
  const dependencies = allDependencies(packageJson);
  const scripts = Object.values(packageJson.scripts ?? {});
  const guesses: ProjectTypeGuess[] = [];
  const exists = async (name: string) => fileExists(join(projectRoot, name));

  if (hasDependency(dependencies, "next") || (await exists("next.config.js")) || (await exists("next.config.mjs"))) {
    guesses.push({
      kind: "nextjs-app",
      confidence: hasDependency(dependencies, "next") ? 0.95 : 0.75,
      evidence: [{ message: "Next.js dependency or config detected" }]
    });
  }

  if (hasDependency(dependencies, "vite") || (await exists("vite.config.ts")) || (await exists("vite.config.js"))) {
    guesses.push({
      kind: "vite-app",
      confidence: hasDependency(dependencies, "vite") ? 0.9 : 0.75,
      evidence: [{ message: "Vite dependency or config detected" }]
    });
  }

  if (hasDependency(dependencies, "react") || hasDependency(dependencies, "react-dom")) {
    guesses.push({
      kind: "react-app",
      confidence: hasDependency(dependencies, "react-dom") ? 0.75 : 0.55,
      evidence: [{ message: "React dependencies detected" }]
    });
  }

  const hasCliSource =
    (await fileStartsWithShebang(join(projectRoot, "src/index.ts"))) ||
    (await fileStartsWithShebang(join(projectRoot, "src/index.js"))) ||
    (await exists("src/cli.ts")) ||
    (await exists("src/cli.js"));
  if (
    packageJson.bin ||
    hasDependency(dependencies, "commander") ||
    hasDependency(dependencies, "yargs") ||
    scripts.some((script) => /\b(commander|cac|yargs|oclif|node\s+.*cli)\b/.test(script)) ||
    hasCliSource
  ) {
    guesses.push({
      kind: "node-cli",
      confidence: packageJson.bin ? 0.95 : hasDependency(dependencies, "commander") || hasDependency(dependencies, "yargs") ? 0.78 : 0.62,
      evidence: [{ message: "CLI entrypoint, bin metadata, or CLI framework detected" }]
    });
  }

  const looksLikeLibrary = Boolean(packageJson.main || packageJson.module || packageJson.types || packageJson.typings || packageJson.exports);
  if (hasDependency(dependencies, "typescript") && looksLikeLibrary) {
    guesses.push({
      kind: "typescript-library",
      confidence: 0.8,
      evidence: [{ message: "TypeScript plus package entrypoint metadata detected" }]
    });
  }

  if (looksLikeLibrary && !packageJson.private) {
    guesses.push({
      kind: "npm-library",
      confidence: packageJson.exports ? 0.78 : 0.62,
      evidence: [{ message: "Package entrypoint metadata suggests a publishable package" }]
    });
  }

  if (packageJson.workspaces || (await exists("pnpm-workspace.yaml")) || (await exists("lerna.json")) || (await exists("turbo.json"))) {
    guesses.push({
      kind: "monorepo",
      confidence: packageJson.workspaces ? 0.95 : 0.8,
      evidence: [{ message: "Workspace metadata or monorepo config detected" }]
    });
  }

  return guesses.length > 0
    ? guesses.sort((a, b) => b.confidence - a.confidence)
    : [{ kind: "unknown", confidence: 0.1, evidence: [{ message: "No strong project type signal found" }] }];
};

export const hasProjectType = (guesses: ProjectTypeGuess[], ...kinds: ProjectTypeGuess["kind"][]): boolean =>
  guesses.some((guess) => kinds.includes(guess.kind) && guess.confidence >= 0.5);
