import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkDependencies } from "../src/checks/dependencies.js";
import type { Issue } from "../src/core/issue.js";

const fixturePath = new URL("./fixtures/messy-dependencies/package.json", import.meta.url);
const messyPackageJson = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("checkDependencies", () => {
	it("detects duplicate dependency names across dependency sections", () => {
		const issues = checkDependencies(messyPackageJson);
		const duplicate = issues.find((issue: Issue) => issue.id === "duplicate-dependency");

		expect(duplicate).toBeDefined();
		expect(duplicate?.evidence).toHaveLength(2);
		expect(duplicate?.evidence.map((entry: { path?: string }) => entry.path ?? "")).toEqual([
			"/dependencies/@types~1node",
			"/optionalDependencies/@types~1node",
		]);
		expect(duplicate?.message).toContain("@types/node");
	});

	it("detects conflicting versions across dependency sections", () => {
		const issues = checkDependencies(messyPackageJson);
		const conflict = issues.find((issue: Issue) => issue.id === "conflicting-dependency-versions");

		expect(conflict).toBeDefined();
		expect(conflict?.evidence).toHaveLength(3);
		expect(conflict?.message).toContain("react");
	});

	it("flags unsorted dependency sections", () => {
		const issues = checkDependencies(messyPackageJson);
		const sortIssues = issues.filter((issue: Issue) => issue.id === "dependency-sort-required");

		expect(sortIssues).toHaveLength(4);
		expect(sortIssues.map((issue) => issue.message)).toEqual([
			"dependencies dependency keys are not sorted alphabetically",
			"devDependencies dependency keys are not sorted alphabetically",
			"peerDependencies dependency keys are not sorted alphabetically",
			"optionalDependencies dependency keys are not sorted alphabetically",
		]);
		expect(sortIssues.every((issue) => issue.fix.classification === "safe")).toBe(true);
	});

	it("marks tooling-only dependencies as review", () => {
		const issues = checkDependencies(messyPackageJson);
		const tooling = issues.find((issue: Issue) => issue.id === "tooling-in-production");

		expect(tooling).toBeDefined();
		expect(tooling?.fix.classification).toBe("review");
		expect(tooling?.message).toContain("typescript");
		expect(tooling?.message).toContain("vite");
	});

	it("returns no issues for already clean dependency metadata", () => {
		const cleanPackageJson = {
			dependencies: {
				"@scope/lib": "^1.0.0",
				lodash: "^4.17.21",
			},
			devDependencies: {
				"@types/lodash": "^4.14.182",
				typescript: "^5.0.0",
			},
			peerDependencies: {
				react: "^18.2.0",
			},
			optionalDependencies: {
				left_pad: "^1.3.0",
			},
		} as const;

		const issues = checkDependencies(cleanPackageJson);
		const unexpectedIds = issues.filter((issue) => issue.id !== "tooling-in-production");
		expect(unexpectedIds).toHaveLength(0);
	});
});
