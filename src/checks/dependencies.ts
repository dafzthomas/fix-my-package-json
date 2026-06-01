import type { Issue, PatchMetadata } from "../core/issue.js";

const dependencySections = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
] as const;

export type DependencySection = (typeof dependencySections)[number];

interface DependencySectionEntry {
	readonly section: DependencySection;
	readonly version: string;
}

type NormalizedDependencyMap = Record<string, string>;

type PackageDependency = Record<string, unknown> | undefined;

export interface PackageJsonLike {
	readonly dependencies?: PackageDependency;
	readonly devDependencies?: PackageDependency;
	readonly peerDependencies?: PackageDependency;
	readonly optionalDependencies?: PackageDependency;
}

const toolingPatterns: readonly RegExp[] = [
	/^@types\//,
	/^eslint(-|$)/,
	/^prettier$/,
	/^prettier-.+$/,
	/^ts-node$/,
	/^tsx$/,
	/^typescript$/,
	/^@typescript-eslint\//,
	/^husky$/,
	/^lint-staged$/,
	/^jest$/,
	/^@jest\//,
	/^vitest$/,
	/^ts-jest$/,
	/^@swc\//,
	/^rollup$/,
	/^rollup-plugin-/,
	/^webpack$/,
	/^vite$/,
	/^@vitejs\//,
	/^babel-eslint$/,
	/^babel-plugin-/,
	/^@babel\//,
	/^tsup$/,
	/^tslib$/,
	/^npm-run-all$/,
	/^rimraf$/,
	/^c8$/,
	/^nyc$/,
	/^mocha$/,
	/^chai$/,
	/^ava$/,
	/^playwright$/,
	/^cypress$/,
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeDependencySection = (value: unknown): NormalizedDependencyMap | null => {
	if (!isRecord(value)) {
		return null;
	}

	const result: NormalizedDependencyMap = {};
	for (const [name, entry] of Object.entries(value)) {
		if (typeof entry === "string") {
			result[name] = entry;
			continue;
		}

		if (isRecord(entry) && typeof entry.version === "string") {
			result[name] = entry.version;
		}
	}

	return result;
};

const jsonPointer = (section: string, key: string): string =>
	`/${section}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;

const areSortedKeys = (keys: string[]): boolean => {
	const sorted = [...keys].sort((a, b) => a.localeCompare(b));
	return keys.every((value, index) => value === sorted[index]);
};

const sortedObject = (value: NormalizedDependencyMap): NormalizedDependencyMap =>
	Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

const isLikelyTooling = (name: string): boolean =>
	toolingPatterns.some((pattern) => pattern.test(name));

export const checkDependencies = (packageJson: PackageJsonLike): Issue[] => {
	const issues: Issue[] = [];

	const sectionEntries = new Map<string, DependencySectionEntry[]>();

	for (const section of dependencySections) {
		const dependencies = normalizeDependencySection(packageJson[section]);
		if (!dependencies || Object.keys(dependencies).length === 0) {
			continue;
		}

		const keys = Object.keys(dependencies);
		if (!areSortedKeys(keys)) {
			const sorted = sortedObject(dependencies);
			issues.push({
				id: "dependency-sort-required",
				severity: "suggestion",
				message: `${section} dependency keys are not sorted alphabetically`,
				evidence: [
					{
						path: `/${section}`,
						message: `Current order: ${keys.join(", ")}`,
						value: keys,
					},
				],
				fix: {
					classification: "safe",
					description: `Sort ${section} alphabetically`,
					patches: [
						{
							operation: "replace",
							path: `/${section}`,
							value: sorted,
							oldValue: dependencies,
							reason: "Deterministic ordering for dependency sections",
						},
					],
				},
			});
		}

		for (const [name, version] of Object.entries(dependencies)) {
			const list = sectionEntries.get(name) ?? [];
			list.push({ section, version });
			sectionEntries.set(name, list);
		}
	}

	for (const [name, occurrences] of sectionEntries) {
		if (occurrences.length < 2) {
			continue;
		}

		const uniqueVersions = [...new Set(occurrences.map((item) => item.version))];

		if (uniqueVersions.length === 1) {
			const safeRemoval = safeDuplicateRemoval(name, occurrences, uniqueVersions[0]);
			issues.push({
				id: "duplicate-dependency",
				severity: "warning",
				message: `${name} is declared in multiple dependency sections with the same version (${uniqueVersions[0]})`,
				evidence: occurrences.map(({ section, version }) => ({
					path: jsonPointer(section, name),
					message: `${section}: ${version}`,
				})),
				fix: {
					classification: safeRemoval ? "safe" : "review",
					description: safeRemoval
						? `Remove duplicate ${name} from devDependencies; dependencies already contains the same version`
						: "Resolve duplicate declaration across dependency sections",
					patches: safeRemoval ? [safeRemoval] : undefined,
					instructions: safeRemoval
						? undefined
						: "Choose the best section for this dependency and keep only one declaration.",
				},
			});
			continue;
		}

		issues.push({
			id: "conflicting-dependency-versions",
			severity: "warning",
			message: `${name} is declared with conflicting versions across dependency sections`,
			evidence: occurrences.map(({ section, version }) => ({
				path: jsonPointer(section, name),
				message: `${section}: ${version}`,
			})),
			fix: {
				classification: "review",
				description: "Review conflicting version requirements",
				instructions:
					"Align dependency versions across sections or remove redundant declarations.",
			},
		});
	}

	const productionDependencies = normalizeDependencySection(packageJson.dependencies);
	if (productionDependencies) {
		const toolingInProduction = Object.keys(productionDependencies).filter(isLikelyTooling);
		if (toolingInProduction.length > 0) {
			issues.push({
				id: "tooling-in-production",
				severity: "warning",
				message:
					`Production dependencies include tooling packages: ${toolingInProduction.join(", ")}`,
				evidence: toolingInProduction.map((name) => ({
					path: jsonPointer("dependencies", name),
					message: `${name} typically belongs in devDependencies`,
					metadata: {
						name,
					},
				})),
				fix: {
					classification: "review",
					description: "Move tooling dependencies to devDependencies where appropriate",
					instructions: "Review each flagged package and move to devDependencies if not required at runtime.",
				},
			});
		}
	}

	return issues;
};

const safeDuplicateRemoval = (
	name: string,
	occurrences: DependencySectionEntry[],
	version: string,
): PatchMetadata | undefined => {
	if (occurrences.length !== 2) {
		return undefined;
	}

	const sections = occurrences.map((item) => item.section).sort();
	if (sections[0] !== "dependencies" || sections[1] !== "devDependencies") {
		return undefined;
	}

	return {
		operation: "remove",
		path: jsonPointer("devDependencies", name),
		oldValue: version,
		reason: "Same version is already present in dependencies",
	};
};
