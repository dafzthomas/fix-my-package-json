import type { Issue, ProjectTypeGuess } from "../core/issue.js";
import { hasProjectType } from "../core/detect-project.js";
import { allDependencies, type PackageJson } from "../core/package-json.js";

const dangerousPatterns = [
  /\brm\s+-rf\s+(\/|\$HOME|~|\.)/,
  /\bgit\s+clean\s+-fdx\b/,
  /\bdel\s+\/[fsq]\b/i
];

const aliasPairs: Array<{ standard: string; alternatives: string[]; commandPattern: RegExp }> = [
  { standard: "test", alternatives: ["unit", "tests"], commandPattern: /\b(vitest|jest|mocha|ava)\b/ },
  { standard: "typecheck", alternatives: ["check-types", "types", "tsc"], commandPattern: /\btsc\b.*(--noEmit)?/ },
  { standard: "lint", alternatives: ["check", "eslint"], commandPattern: /\beslint\b/ }
];

const commandBinary = (command: string): string | undefined => command.trim().split(/\s+/)[0];

const packageBinaryNames = (packageName: string): string[] => {
  if (packageName.startsWith("@types/")) {
    return [];
  }
  if (packageName.startsWith("@")) {
    const [, name] = packageName.split("/");
    return name ? [name] : [];
  }
  return [packageName];
};

export const checkScripts = (packageJson: PackageJson, projectTypes: ProjectTypeGuess[]): Issue[] => {
  const scripts = packageJson.scripts ?? {};
  const dependencies = allDependencies(packageJson);
  const dependencyNames = Object.keys(dependencies);
  const issues: Issue[] = [];

  if (Object.keys(scripts).length === 0 && hasProjectType(projectTypes, "nextjs-app", "vite-app", "react-app", "node-cli", "typescript-library", "npm-library")) {
    issues.push({
      id: "missing-scripts",
      severity: "critical",
      message: "No scripts are defined for this project.",
      evidence: [{ path: "/scripts", message: "scripts object is missing or empty" }],
      fix: {
        classification: "manual",
        description: "Add scripts for the common development lifecycle.",
        instructions: "Add scripts that match this project's actual toolchain."
      }
    });
  }

  for (const [name, command] of Object.entries(scripts)) {
    if (dangerousPatterns.some((pattern) => pattern.test(command)) && !/clean|reset|destroy|prune/.test(name)) {
      issues.push({
        id: "destructive-script",
        severity: "critical",
        message: `Script "${name}" appears destructive without a clear name.`,
        evidence: [{ path: `/scripts/${name}`, message: command, value: command }],
        fix: {
          classification: "manual",
          description: "Rename or rewrite the destructive script.",
          instructions: "Use explicit naming such as clean or reset and confirm the destructive target is scoped."
        }
      });
    }
  }

  for (const pair of aliasPairs) {
    if (scripts[pair.standard]) {
      continue;
    }

    const alternative = pair.alternatives.find((name) => scripts[name] && pair.commandPattern.test(scripts[name]));
    if (alternative) {
      issues.push({
        id: "missing-standard-script",
        severity: "warning",
        message: `Standard script "${pair.standard}" is missing, but "${alternative}" already runs the same tool.`,
        evidence: [{ path: `/scripts/${alternative}`, message: scripts[alternative] }],
        fix: {
          classification: "safe",
          description: `Add "${pair.standard}" as an alias for "${alternative}".`,
          patches: [{ operation: "add", path: `/scripts/${pair.standard}`, value: scripts[alternative], reason: "Underlying command already exists" }]
        }
      });
      issues.push({
        id: "nonstandard-script-name",
        severity: "suggestion",
        message: `Script "${alternative}" is non-standard while standard alias "${pair.standard}" is absent.`,
        evidence: [{ path: `/scripts/${alternative}`, message: scripts[alternative] }],
        fix: {
          classification: "review",
          description: `Keep "${alternative}" if useful, but expose "${pair.standard}" for common tooling expectations.`,
          instructions: `The safe "${pair.standard}" alias is proposed separately.`
        }
      });
      continue;
    }

    const relevantToolExists =
      (pair.standard === "test" && dependencyNames.some((name) => ["vitest", "jest", "mocha", "ava"].includes(name))) ||
      (pair.standard === "lint" && dependencyNames.some((name) => name === "eslint" || name.startsWith("@typescript-eslint/"))) ||
      (pair.standard === "typecheck" && dependencyNames.includes("typescript"));

    if (relevantToolExists) {
      issues.push({
        id: "missing-standard-script",
        severity: "warning",
        message: `Standard script "${pair.standard}" is missing even though matching tooling is installed.`,
        evidence: [{ path: "/scripts", message: `${pair.standard} script absent` }],
        fix: {
          classification: "review",
          description: `Add a "${pair.standard}" script after confirming the desired command.`
        }
      });
    }
  }

  const availableBins = new Set<string>([
    "node",
    "npm",
    "npx",
    "pnpm",
    "yarn",
    "bun",
    "rm",
    "cp",
    "mkdir",
    "echo",
    ...dependencyNames.flatMap(packageBinaryNames),
    "tsc"
  ]);

  for (const [name, command] of Object.entries(scripts)) {
    const binary = commandBinary(command);
    if (!binary || binary.includes("=") || binary.startsWith("node") || binary === "run-s" || binary === "run-p") {
      continue;
    }
    if (!availableBins.has(binary) && !binary.includes("/")) {
      issues.push({
        id: "invalid-script-reference",
        severity: "warning",
        message: `Script "${name}" references "${binary}", but no matching dependency was found.`,
        evidence: [{ path: `/scripts/${name}`, message: command }],
        fix: {
          classification: "manual",
          description: "Install the missing tool or update the script command."
        }
      });
    }
  }

  return issues;
};
