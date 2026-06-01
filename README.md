# fix-my-package-json

A deterministic Node.js CLI that audits a JavaScript or TypeScript project's `package.json`, explains practical problems, and applies conservative safe fixes.

The MVP does not call an LLM for core checks. It uses local files, package metadata, and deterministic rules so it can run in CI.

## Install

```sh
npm install --save-dev fix-my-package-json
```

Or run the local checkout:

```sh
npm install
npm run build
node dist/cli/index.js check --path test/fixtures/vite-app/package.json
```

## Commands

```sh
fix-my-package-json check
fix-my-package-json check --path ./package.json
fix-my-package-json check --json
fix-my-package-json fix
fix-my-package-json fix --write
fix-my-package-json explain
fix-my-package-json doctor
```

The package also exposes the shorter `fmpj` alias.

## What It Checks

Critical checks:

- Invalid JSON.
- Missing scripts for detected project types.
- Duplicate dependency names and conflicting versions across dependency sections.
- Missing `packageManager` when a lockfile identifies the package manager.
- Module-system mismatch risks.
- Destructive scripts without clear naming.

Warnings and suggestions:

- Missing metadata such as `description`, `license`, or `repository`.
- Missing `engines.node`, `bin`, `exports`, `types`, or `files` when relevant.
- Tooling packages in production dependencies.
- Missing standard script aliases such as `test`, `lint`, and `typecheck`.
- Script commands that reference unavailable package binaries.
- Unsorted dependency sections and unconventional top-level field order.
- App packages that may need `private: true`.

## Safe Fixes

`fix-my-package-json fix` previews safe changes. `fix-my-package-json fix --write` applies only safe fixes.

Safe fixes currently include:

- Sorting dependency sections alphabetically.
- Stable pretty-printing and conventional top-level field order.
- Adding `packageManager` when exactly one lockfile is present and a version can be detected or inferred.
- Adding script aliases when the underlying command already exists.
- Removing exact duplicate `devDependencies` entries when the same package and version already exist in `dependencies`.

Review/manual fixes are reported but not applied automatically. These include moving tooling packages, changing versions, adding `exports`, adding `private`, or changing module type.

## Example

Command:

```sh
fix-my-package-json check
```

Output:

```text
fix-my-package-json check

Critical
- packageManager is missing, but pnpm lockfile exists.

Warnings
- Missing package metadata: description, license, repository.

Safe fixes available
- Add packageManager: pnpm@9.0.0
- Sort dependencies alphabetically

Run with --write to apply safe fixes.
```

Machine-readable output:

```sh
fix-my-package-json check --json
```

The JSON report includes the file path, detected package manager, project type guesses, issues, evidence, fix classification, and safe patch metadata.

## Development

```sh
npm install
npm test
npm run typecheck
npm run build
```

Fixture-backed examples:

```sh
node --import tsx src/cli/index.ts check --path test/fixtures/vite-app/package.json
node --import tsx src/cli/index.ts check --path test/fixtures/vite-app/package.json --json
node --import tsx src/cli/index.ts explain --path test/fixtures/library/package.json
```

## Scope

This is an MVP. It does not perform dependency freshness checks, vulnerability scanning, package-manager replacement, hosted UI work, or automatic version changes.
