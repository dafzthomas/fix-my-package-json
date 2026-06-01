#!/usr/bin/env node
import { analyzePackageJsonPath } from "../core/analyze.js";
import { applySafeFixes, previewSafeFixes } from "../core/fix.js";
import { renderDoctor, renderExplain, renderFixResult, renderHumanReport } from "../output/human.js";
import { renderJson } from "../output/json.js";

interface ParsedArgs {
  command: "check" | "fix" | "explain" | "doctor" | "help";
  path?: string;
  json: boolean;
  write: boolean;
}

const usage = `fix-my-package-json

Commands:
  fix-my-package-json check [--path ./package.json] [--json]
  fix-my-package-json fix [--path ./package.json] [--write] [--json]
  fix-my-package-json explain [--path ./package.json]
  fix-my-package-json doctor [--path ./package.json] [--json]

Alias:
  fmpj
`;

const parseArgs = (argv: string[]): ParsedArgs => {
  const [rawCommand = "check", ...rest] = argv;
  const command = ["check", "fix", "explain", "doctor"].includes(rawCommand)
    ? rawCommand as ParsedArgs["command"]
    : rawCommand === "--help" || rawCommand === "-h"
      ? "help"
      : "check";
  const args = command === "check" && rawCommand !== "check" && !rawCommand.startsWith("-") ? argv : rest;
  const parsed: ParsedArgs = { command, json: false, write: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--path") {
      parsed.path = args[index + 1];
      index += 1;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--write") {
      parsed.write = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.command = "help";
    }
  }

  return parsed;
};

export const run = async (argv = process.argv.slice(2)): Promise<number> => {
  const args = parseArgs(argv);

  if (args.command === "help") {
    process.stdout.write(usage);
    return 0;
  }

  if (args.command === "fix") {
    const result = args.write ? await applySafeFixes(args.path) : await previewSafeFixes(args.path);
    process.stdout.write(args.json ? renderJson(result) : renderFixResult(result, args.write));
    return result.results.some((item) => item.status === "failed") ? 1 : 0;
  }

  const report = await analyzePackageJsonPath(args.path);
  const hasCriticalIssues = report.issues.some((issue) => issue.severity === "critical");
  if (args.json) {
    process.stdout.write(renderJson(report));
    return hasCriticalIssues ? 1 : 0;
  }

  if (args.command === "explain") {
    process.stdout.write(renderExplain(report));
    return 0;
  }

  if (args.command === "doctor") {
    process.stdout.write(renderDoctor(report));
    return hasCriticalIssues ? 1 : 0;
  }

  process.stdout.write(renderHumanReport(report));
  return hasCriticalIssues ? 1 : 0;
};

run().then((exitCode) => {
  process.exitCode = exitCode;
}).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
