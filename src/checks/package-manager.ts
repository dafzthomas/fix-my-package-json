import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DetectedPackageManager, Issue, PackageManagerName } from "../core/issue.js";
import type { PackageJson } from "../core/package-json.js";
import { fileExists } from "../core/context.js";

const execFileAsync = promisify(execFile);

const lockfiles: Array<{ name: PackageManagerName; file: string }> = [
  { name: "pnpm", file: "pnpm-lock.yaml" },
  { name: "yarn", file: "yarn.lock" },
  { name: "bun", file: "bun.lock" },
  { name: "bun", file: "bun.lockb" },
  { name: "npm", file: "package-lock.json" },
  { name: "npm", file: "npm-shrinkwrap.json" }
];

export const parsePackageManagerField = (value: unknown): DetectedPackageManager | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = /^(npm|pnpm|yarn|bun)@(.+)$/.exec(value);
  if (!match) {
    return { name: "unknown", confidence: 0.2 };
  }

  return {
    name: match[1] as PackageManagerName,
    version: match[2],
    versionSource: "declared",
    confidence: 1
  };
};

export const versionFromUserAgent = (name: PackageManagerName): string | undefined => {
  const userAgent = process.env.npm_config_user_agent;
  if (!userAgent) {
    return undefined;
  }

  const match = new RegExp(`${name}/([^\\s]+)`).exec(userAgent);
  return match?.[1];
};

const versionCommands: Partial<Record<PackageManagerName, string>> = {
  npm: "npm",
  pnpm: "pnpm",
  yarn: "yarn",
  bun: "bun"
};

export const detectPackageManagerVersion = async (name: PackageManagerName): Promise<Pick<DetectedPackageManager, "version" | "versionSource">> => {
  const fromUserAgent = versionFromUserAgent(name);
  if (fromUserAgent) {
    return { version: fromUserAgent, versionSource: "environment" };
  }

  const command = versionCommands[name];
  if (!command) {
    return {};
  }

  try {
    const { stdout } = await execFileAsync(command, ["--version"], { timeout: 2000 });
    return { version: stdout.trim().split(/\s+/)[0], versionSource: "command" };
  } catch {
    return {};
  }
};

const inferVersionFromLockfile = async (name: PackageManagerName, lockfilePath: string): Promise<string | undefined> => {
  try {
    const contents = await readFile(lockfilePath, "utf8");
    if (name === "pnpm") {
      const match = /lockfileVersion:\s*['"]?(\d+)/.exec(contents);
      return match ? `${match[1]}.0.0` : undefined;
    }
    if (name === "npm") {
      const parsed = JSON.parse(contents) as { packageManager?: string; lockfileVersion?: number };
      const declared = parsePackageManagerField(parsed.packageManager);
      if (declared?.version) {
        return declared.version;
      }
      if (parsed.lockfileVersion === 3) {
        return "9.0.0";
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const detectPackageManager = async (projectRoot: string, packageJson: PackageJson): Promise<DetectedPackageManager> => {
  const declared = parsePackageManagerField(packageJson.packageManager);
  if (declared && declared.name !== "unknown") {
    return declared;
  }

  for (const candidate of lockfiles) {
    const lockfilePath = join(projectRoot, candidate.file);
    if (await fileExists(lockfilePath)) {
      const lockfileVersion = await inferVersionFromLockfile(candidate.name, lockfilePath);
      const runtimeVersion = lockfileVersion ? {} : await detectPackageManagerVersion(candidate.name);
      return {
        name: candidate.name,
        version: lockfileVersion ?? runtimeVersion.version,
        versionSource: lockfileVersion ? "lockfile" : runtimeVersion.versionSource,
        confidence: 0.9,
        lockfilePath
      };
    }
  }

  return { name: "unknown", confidence: 0.1 };
};

export const checkPackageManager = (packageJson: PackageJson, detected: DetectedPackageManager): Issue[] => {
  if (packageJson.packageManager || detected.name === "unknown" || !detected.lockfilePath) {
    return [];
  }

  const version = detected.version;
  const canApplySafely = Boolean(version && detected.versionSource === "lockfile");
  return [
    {
      id: "missing-package-manager",
      severity: "critical",
      message: `packageManager is missing, but ${detected.name} lockfile exists.`,
      evidence: [
        {
          path: "/packageManager",
          message: `${detected.name} lockfile detected`,
          reference: detected.lockfilePath
        }
      ],
      fix: {
        classification: canApplySafely ? "safe" : "review",
        description: canApplySafely
          ? `Add packageManager: ${detected.name}@${version}`
          : `Add packageManager for ${detected.name} after confirming the version`,
        patches: canApplySafely
          ? [{ operation: "add", path: "/packageManager", value: `${detected.name}@${version}`, reason: "Lockfile indicates package manager" }]
          : undefined,
        instructions: canApplySafely ? undefined : `Run ${detected.name} --version and add packageManager manually.`
      }
    }
  ];
};
