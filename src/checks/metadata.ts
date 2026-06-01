import type { Issue, ProjectTypeGuess } from "../core/issue.js";
import { hasProjectType } from "../core/detect-project.js";
import type { PackageJson } from "../core/package-json.js";

const metadataFields = ["name", "version", "description", "license", "repository"] as const;

export const checkMetadata = (packageJson: PackageJson, projectTypes: ProjectTypeGuess[]): Issue[] => {
  const issues: Issue[] = [];
  const missing = metadataFields.filter((field) => packageJson[field] === undefined || packageJson[field] === "");

  if (missing.length > 0) {
    issues.push({
      id: "missing-package-metadata",
      severity: "warning",
      message: `Missing package metadata: ${missing.join(", ")}.`,
      evidence: missing.map((field) => ({ path: `/${field}`, message: `${field} is missing` })),
      fix: {
        classification: "manual",
        description: "Add package metadata that humans and registries can trust.",
        instructions: "Fill in the missing metadata fields based on the package's intended identity and publish target."
      }
    });
  }

  if ((hasProjectType(projectTypes, "nextjs-app", "vite-app", "node-cli") || packageJson.bin) && !packageJson.engines?.node) {
    issues.push({
      id: "missing-engines-node",
      severity: "warning",
      message: "engines.node is missing.",
      evidence: [{ path: "/engines/node", message: "No minimum Node.js version is declared" }],
      fix: {
        classification: "review",
        description: "Declare a supported Node.js runtime range.",
        instructions: "Choose the oldest Node.js version this project supports and set engines.node."
      }
    });
  }

  if (hasProjectType(projectTypes, "node-cli") && !packageJson.bin) {
    issues.push({
      id: "missing-bin",
      severity: "warning",
      message: "Package looks like a CLI but does not declare bin.",
      evidence: [{ path: "/bin", message: "CLI signals found without executable package metadata" }],
      fix: {
        classification: "review",
        description: "Add bin metadata for command installation.",
        instructions: "Point bin at the built CLI entrypoint after confirming the command name."
      }
    });
  }

  return issues;
};
