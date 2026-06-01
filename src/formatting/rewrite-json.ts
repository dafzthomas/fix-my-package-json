import { orderedPackageJson } from "../checks/order.js";
import { dependencySections, type DependencySection, type PackageJson } from "../core/package-json.js";

const sortRecord = (record: Record<string, string> | undefined): Record<string, string> | undefined => {
  if (!record) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
};

export const rewritePackageJson = (packageJson: PackageJson): string => {
  const clone: PackageJson = { ...packageJson };
  for (const section of dependencySections) {
    clone[section as DependencySection] = sortRecord(clone[section]);
  }

  return `${JSON.stringify(orderedPackageJson(clone), null, 2)}\n`;
};
