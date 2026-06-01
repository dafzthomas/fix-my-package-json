export type JsonObject = Record<string, unknown>;

export interface PackageJson extends JsonObject {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
  repository?: unknown;
  private?: boolean;
  type?: string;
  main?: string;
  module?: string;
  types?: string;
  typings?: string;
  files?: unknown;
  bin?: unknown;
  exports?: unknown;
  packageManager?: string;
  workspaces?: unknown;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: { node?: string; [key: string]: unknown };
  publishConfig?: unknown;
  sideEffects?: unknown;
}

export const isRecord = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string");
  return Object.fromEntries(entries);
};

export const normalizePackageJson = (value: unknown): PackageJson => {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...value,
    scripts: asStringRecord(value.scripts),
    dependencies: asStringRecord(value.dependencies),
    devDependencies: asStringRecord(value.devDependencies),
    peerDependencies: asStringRecord(value.peerDependencies),
    optionalDependencies: asStringRecord(value.optionalDependencies),
    engines: isRecord(value.engines) ? value.engines : undefined
  } as PackageJson;
};

export const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies"
] as const;

export type DependencySection = (typeof dependencySections)[number];

export const allDependencies = (packageJson: PackageJson): Record<string, string> => {
  const merged: Record<string, string> = {};

  for (const section of dependencySections) {
    Object.assign(merged, packageJson[section]);
  }

  return merged;
};
