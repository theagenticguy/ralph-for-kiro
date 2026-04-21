import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HOOK_FILES, installHookScripts } from "../src/core/hook-installer.ts";
import { buildHookEnv } from "../src/core/kiro-client.ts";
import { LoopConfigSchema } from "../src/schemas/config.ts";

describe("buildHookEnv", () => {
	test("returns parent env unchanged when no hook env is given", () => {
		const env = buildHookEnv();
		expect(env["PATH"]).toBe(process.env["PATH"]);
		expect(env["RALPH_RUN_DIR"]).toBeUndefined();
		expect(env["RALPH_ITERATION"]).toBeUndefined();
	});

	test("injects RALPH_* vars when hookEnv fields are provided", () => {
		const env = buildHookEnv({
			runDir: "/tmp/ralph-run",
			iteration: 3,
			scoutName: "ai-eval",
		});
		expect(env["RALPH_RUN_DIR"]).toBe("/tmp/ralph-run");
		expect(env["RALPH_ITERATION"]).toBe("3");
		expect(env["RALPH_SCOUT_NAME"]).toBe("ai-eval");
	});

	test("omits keys that are not provided", () => {
		const env = buildHookEnv({ iteration: 1 });
		expect(env["RALPH_ITERATION"]).toBe("1");
		expect(env["RALPH_RUN_DIR"]).toBeUndefined();
		expect(env["RALPH_SCOUT_NAME"]).toBeUndefined();
	});

	test("empty scoutName is still emitted (distinguishes scout vs non-scout)", () => {
		const env = buildHookEnv({ scoutName: "" });
		expect(env["RALPH_SCOUT_NAME"]).toBe("");
	});
});

describe("installHookScripts", () => {
	test("writes both hook scripts and makes them executable", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-hooks-"));
		try {
			const hooksDir = join(tempDir, "hooks");
			const written = await installHookScripts(hooksDir);

			expect(written.length).toBe(2);

			for (const scriptName of Object.values(HOOK_FILES)) {
				const scriptPath = join(hooksDir, scriptName);
				// Single stat() — avoids the access()-then-stat TOCTOU that
				// CodeQL flags as js/file-system-race. stat() throws ENOENT
				// if the file doesn't exist, which fails the test cleanly.
				const st = await stat(scriptPath);
				expect(st.mode & 0o100).toBe(0o100);

				const body = await readFile(scriptPath, "utf-8");
				expect(body.startsWith("#!/usr/bin/env bash")).toBe(true);
				expect(body).toContain("RALPH_RUN_DIR");
			}
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("is idempotent — second call overwrites cleanly", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-hooks-"));
		try {
			const hooksDir = join(tempDir, "hooks");
			await installHookScripts(hooksDir);
			const second = await installHookScripts(hooksDir);
			expect(second.length).toBe(2);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("LoopConfig runDir / scoutName defaults", () => {
	test("runDir and scoutName default to null", () => {
		const config = LoopConfigSchema.parse({
			prompt: "test",
			minIterations: 1,
			maxIterations: 1,
			completionPromise: "DONE",
		});
		expect(config.runDir).toBeNull();
		expect(config.scoutName).toBeNull();
	});

	test("runDir and scoutName round-trip when set", () => {
		const config = LoopConfigSchema.parse({
			prompt: "test",
			minIterations: 1,
			maxIterations: 1,
			completionPromise: "DONE",
			runDir: "/tmp/pw-run",
			scoutName: "ai-eval",
		});
		expect(config.runDir).toBe("/tmp/pw-run");
		expect(config.scoutName).toBe("ai-eval");
	});
});
