import { execFile, type ExecFileException } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = new URL("../src/cli/index.ts", import.meta.url).pathname;
const fixture = (name: string) => new URL(`./fixtures/${name}/package.json`, import.meta.url).pathname;

async function runCli(args: string[]) {
  return execFileAsync("node", ["--import", "tsx", cliPath, ...args], {
    env: { ...process.env, FORCE_COLOR: "0" }
  });
}

async function runCliWithStatus(args: string[]) {
  try {
    const result = await runCli(args);
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const execError = error as ExecFileException & { stdout: string; stderr: string };
    return { code: execError.code ?? 1, stdout: execError.stdout, stderr: execError.stderr };
  }
}

describe("CLI", () => {
  it("prints a human report for check", async () => {
    const { code, stdout } = await runCliWithStatus(["check", "--path", fixture("vite-app")]);

    expect(code).toBe(1);
    expect(stdout).toContain("fix-my-package-json check");
    expect(stdout).toContain("Critical");
    expect(stdout).toContain("Warnings");
    expect(stdout).toContain("Safe fixes available");
    expect(stdout).toContain("packageManager is missing");
  });

  it("prints JSON for automation", async () => {
    const { code, stdout } = await runCliWithStatus(["check", "--path", fixture("vite-app"), "--json"]);
    const parsed = JSON.parse(stdout);

    expect(code).toBe(1);
    expect(parsed.filePath).toContain("vite-app/package.json");
    expect(parsed.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "missing-package-manager" })])
    );
  });

  it("previews fixes without applying them", async () => {
    const { stdout } = await runCli(["fix", "--path", fixture("vite-app")]);

    expect(stdout).toContain("Safe fixes available");
    expect(stdout).toContain("Run with --write");
  });

  it("prints explanations for detected issues", async () => {
    const { stdout } = await runCli(["explain", "--path", fixture("library")]);

    expect(stdout).toContain("Explanations");
    expect(stdout).toContain("missing-exports");
  });

  it("exits non-zero for invalid JSON in check and doctor", async () => {
    const check = await runCliWithStatus(["check", "--path", fixture("invalid-json")]);
    const doctor = await runCliWithStatus(["doctor", "--path", fixture("invalid-json")]);

    expect(check.code).toBe(1);
    expect(check.stdout).toContain("package.json is not valid JSON");
    expect(doctor.code).toBe(1);
  });

  it("exits non-zero and explains parse failures for fix", async () => {
    const fix = await runCliWithStatus(["fix", "--path", fixture("invalid-json")]);
    const fixJson = await runCliWithStatus(["fix", "--path", fixture("invalid-json"), "--json"]);
    const parsed = JSON.parse(fixJson.stdout);

    expect(fix.code).toBe(1);
    expect(fix.stdout).toContain("Could not apply fixes");
    expect(fix.stdout).toContain("package.json is not valid JSON");
    expect(fixJson.code).toBe(1);
    expect(parsed.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ issueId: "invalid-json", status: "failed" })])
    );
  });
});
