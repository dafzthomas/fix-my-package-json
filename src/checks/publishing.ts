import type { Issue, ProjectTypeGuess } from "../core/issue.js";
import { hasProjectType } from "../core/detect-project.js";
import type { PackageJson } from "../core/package-json.js";

export const checkPublishing = (packageJson: PackageJson, projectTypes: ProjectTypeGuess[]): Issue[] => {
  const issues: Issue[] = [];
  const isLibrary = hasProjectType(projectTypes, "typescript-library", "npm-library");

  if (isLibrary && packageJson.exports === undefined) {
    issues.push({
      id: "missing-exports",
      severity: "warning",
      message: "Library package is missing exports.",
      evidence: [{ path: "/exports", message: "No package exports map is declared" }],
      fix: {
        classification: "review",
        description: "Add an exports map after confirming public entrypoints.",
        instructions: "Expose only the supported entrypoints for consumers."
      }
    });
  }

  if (isLibrary && packageJson.types === undefined && packageJson.typings === undefined) {
    issues.push({
      id: "missing-types",
      severity: "warning",
      message: "TypeScript library is missing types metadata.",
      evidence: [{ path: "/types", message: "No types or typings field is declared" }],
      fix: {
        classification: "review",
        description: "Point types at generated declaration files."
      }
    });
  }

  if (isLibrary && packageJson.files === undefined) {
    issues.push({
      id: "missing-files",
      severity: "warning",
      message: "Publishable package is missing files allowlist.",
      evidence: [{ path: "/files", message: "No npm publish files allowlist is declared" }],
      fix: {
        classification: "review",
        description: "Add a files allowlist after confirming build outputs."
      }
    });
  }

  if (isLibrary && !packageJson.publishConfig && packageJson.private !== true) {
    issues.push({
      id: "missing-publish-config",
      severity: "suggestion",
      message: "Publishable package may benefit from publishConfig.",
      evidence: [{ path: "/publishConfig", message: "No publishConfig field is declared" }],
      fix: {
        classification: "review",
        description: "Add publishConfig only if this package should be published to a specific registry or access level."
      }
    });
  }

  if (isLibrary && packageJson.sideEffects === undefined) {
    issues.push({
      id: "missing-side-effects",
      severity: "suggestion",
      message: "Library may be eligible for sideEffects: false.",
      evidence: [{ path: "/sideEffects", message: "No sideEffects field is declared" }],
      fix: {
        classification: "review",
        description: "Add sideEffects: false only after confirming imports have no side effects."
      }
    });
  }

  if (hasProjectType(projectTypes, "nextjs-app", "vite-app", "react-app") && packageJson.private !== true) {
    issues.push({
      id: "missing-private",
      severity: "suggestion",
      message: "Application package is not marked private.",
      evidence: [{ path: "/private", message: "private is not true" }],
      fix: {
        classification: "review",
        description: "Add private: true if this app is not intended for npm publication."
      }
    });
  }

  return issues;
};
