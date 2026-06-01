import type { Issue } from "../core/issue.js";
import type { PackageJson } from "../core/package-json.js";

const conventionalOrder = [
  "name",
  "version",
  "description",
  "type",
  "private",
  "license",
  "repository",
  "packageManager",
  "engines",
  "bin",
  "main",
  "module",
  "types",
  "exports",
  "files",
  "sideEffects",
  "scripts",
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "publishConfig"
];

export const orderedPackageJson = (packageJson: PackageJson): PackageJson => {
  const result: PackageJson = {};
  for (const key of conventionalOrder) {
    if (Object.prototype.hasOwnProperty.call(packageJson, key)) {
      result[key] = packageJson[key];
    }
  }
  for (const key of Object.keys(packageJson)) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = packageJson[key];
    }
  }
  return result;
};

export const checkTopLevelOrder = (packageJson: PackageJson): Issue[] => {
  const keys = Object.keys(packageJson);
  const orderedKeys = Object.keys(orderedPackageJson(packageJson));

  if (keys.every((key, index) => key === orderedKeys[index])) {
    return [];
  }

  return [
    {
      id: "top-level-sort-required",
      severity: "suggestion",
      message: "Top-level package.json fields are not in conventional order.",
      evidence: [{ path: "/", message: `Current order: ${keys.join(", ")}`, value: keys }],
      fix: {
        classification: "safe",
        description: "Rewrite top-level fields in conventional order."
      }
    }
  ];
};
