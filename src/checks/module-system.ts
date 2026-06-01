import { join } from "node:path";
import type { Issue } from "../core/issue.js";
import { fileExists } from "../core/context.js";
import type { PackageJson } from "../core/package-json.js";

export const checkModuleSystem = async (projectRoot: string, packageJson: PackageJson): Promise<Issue[]> => {
  const issues: Issue[] = [];
  const hasCjsConfig = (await fileExists(join(projectRoot, "webpack.config.cjs"))) || (await fileExists(join(projectRoot, "rollup.config.cjs")));
  const hasMjsConfig = (await fileExists(join(projectRoot, "eslint.config.mjs"))) || (await fileExists(join(projectRoot, "rollup.config.mjs")));

  if (packageJson.type === "module" && typeof packageJson.main === "string" && packageJson.main.endsWith(".cjs")) {
    issues.push({
      id: "type-field-risk",
      severity: "critical",
      message: "type is module but main points at a CommonJS entrypoint.",
      evidence: [
        { path: "/type", message: "type is module", value: packageJson.type },
        { path: "/main", message: "main ends in .cjs", value: packageJson.main }
      ],
      fix: {
        classification: "manual",
        description: "Review the package module format before changing type or entrypoints."
      }
    });
  }

  if (packageJson.type === "commonjs" && hasMjsConfig) {
    issues.push({
      id: "type-field-risk",
      severity: "critical",
      message: "type is commonjs while ESM config files are present.",
      evidence: [{ path: "/type", message: "ESM config file detected", value: packageJson.type }],
      fix: { classification: "manual", description: "Review module system settings." }
    });
  }

  if (packageJson.type === "module" && hasCjsConfig) {
    issues.push({
      id: "type-field-risk",
      severity: "warning",
      message: "type is module while CommonJS config files are present.",
      evidence: [{ path: "/type", message: "CommonJS config file detected", value: packageJson.type }],
      fix: { classification: "manual", description: "Confirm CommonJS config files are intentional." }
    });
  }

  return issues;
};
