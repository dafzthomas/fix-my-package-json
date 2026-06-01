import { checkDependencies } from "../checks/dependencies.js";
import { checkMetadata } from "../checks/metadata.js";
import { checkModuleSystem } from "../checks/module-system.js";
import { checkPackageManager, detectPackageManager } from "../checks/package-manager.js";
import { checkPublishing } from "../checks/publishing.js";
import { checkScripts } from "../checks/scripts.js";
import { checkTopLevelOrder } from "../checks/order.js";
import { loadPackageContext } from "./context.js";
import { detectProjectTypes } from "./detect-project.js";
import type { AnalysisReport, Issue } from "./issue.js";

const severityRank: Record<Issue["severity"], number> = {
  critical: 0,
  warning: 1,
  suggestion: 2,
  info: 3
};

export const sortIssues = (issues: Issue[]): Issue[] =>
  [...issues].sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.id.localeCompare(b.id));

export const analyzePackageJsonPath = async (pathArg?: string): Promise<AnalysisReport> => {
  const context = await loadPackageContext(pathArg);

  if (!context.packageJson) {
    return {
      filePath: context.filePath,
      generatedAt: new Date().toISOString(),
      projectTypeGuesses: [{ kind: "unknown", confidence: 0, evidence: [{ message: "package.json could not be parsed" }] }],
      packageManager: { name: "unknown", confidence: 0 },
      issues: [
        {
          id: "invalid-json",
          severity: "critical",
          message: "package.json is not valid JSON.",
          details: context.parseError?.message,
          evidence: [{ path: context.filePath, message: context.parseError?.message ?? "JSON parsing failed" }],
          fix: {
            classification: "manual",
            description: "Fix JSON syntax before other checks can run.",
            instructions: "Remove trailing commas, comments, and malformed values, then rerun the check."
          }
        }
      ]
    };
  }

  const projectTypeGuesses = await detectProjectTypes({
    projectRoot: context.projectRoot,
    packageJson: context.packageJson
  });
  const packageManager = await detectPackageManager(context.projectRoot, context.packageJson);

  const issues = sortIssues([
    ...checkPackageManager(context.packageJson, packageManager),
    ...checkDependencies(context.packageJson),
    ...checkMetadata(context.packageJson, projectTypeGuesses),
    ...checkScripts(context.packageJson, projectTypeGuesses),
    ...(await checkModuleSystem(context.projectRoot, context.packageJson)),
    ...checkPublishing(context.packageJson, projectTypeGuesses),
    ...checkTopLevelOrder(context.packageJson)
  ]);

  return {
    filePath: context.filePath,
    generatedAt: new Date().toISOString(),
    projectTypeGuesses,
    packageManager,
    issues
  };
};
