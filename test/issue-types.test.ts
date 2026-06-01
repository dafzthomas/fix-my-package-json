import { describe, expect, it } from "vitest";
import type { Issue, IssueFixResult, ProjectTypeGuess } from "../src/core/issue.js";

describe("issue type contracts", () => {
	it("accepts a typed analysis issue", () => {
		const issue: Issue = {
			id: "missing-package-manager",
			severity: "warning",
			message: "Add packageManager for reproducible installs",
			evidence: [
				{
					message: "Detected pnpm-lock.yaml",
					path: "/",
				},
			],
			fix: {
				classification: "safe",
				description: "Infer manager and pin version",
				patches: [],
			},
		};

		expect(issue.id).toBe("missing-package-manager");
	});

	it("accepts a typed fix result", () => {
		const guess: ProjectTypeGuess = {
			kind: "vite-app",
			confidence: 0.92,
			evidence: [{ message: "vite.config.ts found" }],
		};

		const result: IssueFixResult = {
			issueId: "missing-package-manager",
			classification: "safe",
			status: "applied" as const,
			message: "Applied packageManager",
			patches: [],
		};

		expect(guess.kind).toBe("vite-app");
		expect(result.status).toBe("applied");
	});
});
