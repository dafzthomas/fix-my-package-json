import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { normalizePackageJson, type PackageJson } from "./package-json.js";

export interface PackageContext {
  filePath: string;
  projectRoot: string;
  raw: string;
  packageJson?: PackageJson;
  parseError?: Error;
}

export const resolvePackagePath = (pathArg?: string): string => {
  const target = pathArg ?? "package.json";
  const resolved = resolve(process.cwd(), target);
  return resolved.endsWith("package.json") ? resolved : resolve(resolved, "package.json");
};

export const loadPackageContext = async (pathArg?: string): Promise<PackageContext> => {
  const filePath = resolvePackagePath(pathArg);
  const raw = await readFile(filePath, "utf8");

  try {
    return {
      filePath,
      projectRoot: dirname(filePath),
      raw,
      packageJson: normalizePackageJson(JSON.parse(raw))
    };
  } catch (error) {
    return {
      filePath,
      projectRoot: dirname(filePath),
      raw,
      parseError: error instanceof Error ? error : new Error(String(error))
    };
  }
};

export const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
