import type { AnalysisReport, Issue, IssueSeverity } from "../core/issue.js";
import type { PackageFixResult } from "../core/fix.js";

const headings: Array<[IssueSeverity, string]> = [
  ["critical", "Critical"],
  ["warning", "Warnings"],
  ["suggestion", "Suggestions"],
  ["info", "Info"]
];

const formatIssue = (issue: Issue): string => `- ${issue.message}`;

export const renderHumanReport = (report: AnalysisReport): string => {
  const lines = ["fix-my-package-json check", "", `File: ${report.filePath}`];
  const projectTypes = report.projectTypeGuesses
    .filter((guess) => guess.kind !== "unknown")
    .map((guess) => `${guess.kind} (${Math.round(guess.confidence * 100)}%)`);

  if (projectTypes.length > 0) {
    lines.push(`Project: ${projectTypes.join(", ")}`);
  }
  if (report.packageManager.name !== "unknown") {
    lines.push(`Package manager: ${report.packageManager.name}${report.packageManager.version ? `@${report.packageManager.version}` : ""}`);
  }
  lines.push("");

  for (const [severity, heading] of headings) {
    const issues = report.issues.filter((issue) => issue.severity === severity);
    lines.push(heading);
    lines.push(...(issues.length > 0 ? issues.map(formatIssue) : ["- None"]));
    lines.push("");
  }

  const safeFixes = report.issues.filter((issue) => issue.fix.classification === "safe");
  lines.push("Safe fixes available");
  lines.push(...(safeFixes.length > 0 ? safeFixes.map((issue) => `- ${issue.fix.description}`) : ["- None"]));
  if (safeFixes.length > 0) {
    lines.push("");
    lines.push("Run with --write to apply safe fixes.");
  }

  return `${lines.join("\n")}\n`;
};

export const renderExplain = (report: AnalysisReport): string => {
  const lines = ["Explanations", "", `File: ${report.filePath}`, ""];
  for (const issue of report.issues) {
    lines.push(`${issue.id}: ${issue.message}`);
    if (issue.details) {
      lines.push(`  ${issue.details}`);
    }
    lines.push(`  Fix: ${issue.fix.classification} - ${issue.fix.description}`);
    if (issue.fix.instructions) {
      lines.push(`  Next: ${issue.fix.instructions}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
};

export const renderDoctor = (report: AnalysisReport): string => {
  const lines = [
    "fix-my-package-json doctor",
    "",
    `File: ${report.filePath}`,
    `Package manager: ${report.packageManager.name}${report.packageManager.version ? `@${report.packageManager.version}` : ""}`,
    `Project guesses: ${report.projectTypeGuesses.map((guess) => `${guess.kind}:${Math.round(guess.confidence * 100)}%`).join(", ")}`,
    "",
    renderHumanReport(report).trimEnd()
  ];
  return `${lines.join("\n")}\n`;
};

export const renderFixResult = (result: PackageFixResult, write: boolean): string => {
  const failedResults = result.results.filter((item) => item.status === "failed");
  if (failedResults.length > 0) {
    const lines = ["Could not apply fixes", "", `File: ${result.filePath}`];
    lines.push(...failedResults.map((item) => `- ${item.message ?? item.issueId}`));
    return `${lines.join("\n")}\n`;
  }

  const safeResults = result.results.filter((item) => item.classification === "safe");
  const lines = [write ? "Applied safe fixes" : "Safe fixes available", "", `File: ${result.filePath}`];

  if (safeResults.length === 0) {
    lines.push("- None");
  } else {
    lines.push(...safeResults.map((item) => `- ${item.message ?? item.issueId}`));
  }

  if (!write) {
    lines.push("");
    lines.push("Run with --write to apply safe fixes.");
  }

  return `${lines.join("\n")}\n`;
};
