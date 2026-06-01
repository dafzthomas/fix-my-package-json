export type IssueSeverity = "critical" | "warning" | "suggestion" | "info";

export type IssueId =
	| "invalid-json"
	| "missing-scripts"
	| "duplicate-dependency"
	| "conflicting-dependency-versions"
	| "dependency-sort-required"
	| "missing-package-manager"
	| "type-field-risk"
	| "destructive-script"
	| "missing-package-metadata"
	| "missing-engines-node"
	| "missing-bin"
	| "missing-exports"
	| "missing-types"
	| "missing-files"
	| "tooling-in-production"
	| "missing-standard-script"
	| "invalid-script-reference"
	| "nonstandard-script-name"
	| (string & {});

export type JsonPath = string;

export interface Evidence {
	path?: JsonPath;
	message: string;
	value?: unknown;
	reference?: string;
	metadata?: Record<string, unknown>;
}

export type FixClassification = "safe" | "review" | "manual";

export type PatchOperation = "add" | "replace" | "remove";

export interface PatchMetadata {
	operation: PatchOperation;
	path: JsonPath;
	value?: unknown;
	oldValue?: unknown;
	reason?: string;
}

export interface IssueFix {
	classification: FixClassification;
	description: string;
	patches?: PatchMetadata[];
	instructions?: string;
}

export interface Issue {
	id: IssueId;
	severity: IssueSeverity;
	message: string;
	details?: string;
	evidence: Evidence[];
	fix: IssueFix;
	confidence?: number;
	docsUrl?: string;
}

export type PackageManagerName = "npm" | "yarn" | "pnpm" | "bun" | "deno" | "unknown";

export interface DetectedPackageManager {
	name: PackageManagerName;
	version?: string;
	versionSource?: "declared" | "lockfile" | "environment" | "command";
	confidence?: number;
	lockfilePath?: string;
}

export type ProjectTypeGuessKind =
	| "nextjs-app"
	| "vite-app"
	| "react-app"
	| "node-cli"
	| "typescript-library"
	| "npm-library"
	| "monorepo"
	| "unknown";

export interface ProjectTypeGuess {
	kind: ProjectTypeGuessKind;
	confidence: number;
	evidence: Evidence[];
	notes?: string;
}

export interface AnalysisReport {
	filePath: string;
	generatedAt: string;
	projectTypeGuesses: ProjectTypeGuess[];
	packageManager: DetectedPackageManager;
	issues: Issue[];
}

export type FixExecutionStatus = "applied" | "skipped" | "failed" | "not-applicable";

export interface IssueFixResult {
	issueId: IssueId;
	classification: FixClassification;
	status: FixExecutionStatus;
	message?: string;
	patches?: PatchMetadata[];
}

export interface FixResult {
	filePath: string;
	appliedAt: string;
	projectTypeGuesses: ProjectTypeGuess[];
	packageManager: DetectedPackageManager;
	results: IssueFixResult[];
}
