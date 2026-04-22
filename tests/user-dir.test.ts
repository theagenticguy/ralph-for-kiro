import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	getUserDir,
	resolveUserDir,
	resultsDir,
	scoutsDir,
	setUserDir,
	watchManifestFile,
} from "../src/utils/paths.ts";

describe("user-directory resolution", () => {
	const originalCwd = process.cwd();
	const originalEnv = {
		RALPH_USER_DIR: process.env["RALPH_USER_DIR"],
		XDG_CONFIG_HOME: process.env["XDG_CONFIG_HOME"],
	};

	beforeEach(() => {
		// Start each test with a known clean state.
		setUserDir(null);
		delete process.env["RALPH_USER_DIR"];
		delete process.env["XDG_CONFIG_HOME"];
	});

	afterEach(() => {
		// Restore prior global state so test order can't leak.
		setUserDir(null);
		process.chdir(originalCwd);
		if (originalEnv.RALPH_USER_DIR !== undefined) {
			process.env["RALPH_USER_DIR"] = originalEnv.RALPH_USER_DIR;
		} else {
			delete process.env["RALPH_USER_DIR"];
		}
		if (originalEnv.XDG_CONFIG_HOME !== undefined) {
			process.env["XDG_CONFIG_HOME"] = originalEnv.XDG_CONFIG_HOME;
		} else {
			delete process.env["XDG_CONFIG_HOME"];
		}
	});

	test("fallback to process.cwd() when no flag/env/xdg", () => {
		expect(resolveUserDir()).toBe(originalCwd);
	});

	test("--user-dir flag beats everything else", async () => {
		const tmp = await mkdtemp(join(tmpdir(), "ralph-user-"));
		try {
			process.env["RALPH_USER_DIR"] = "/tmp/env-should-lose";
			setUserDir(tmp);
			expect(resolveUserDir()).toBe(resolve(tmp));
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	test("RALPH_USER_DIR env var wins over XDG + cwd fallbacks", async () => {
		const tmp = await mkdtemp(join(tmpdir(), "ralph-env-"));
		try {
			process.env["RALPH_USER_DIR"] = tmp;
			expect(resolveUserDir()).toBe(resolve(tmp));
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});

	test("XDG default wins over cwd fallback when its directory exists", async () => {
		const xdg = await mkdtemp(join(tmpdir(), "ralph-xdg-"));
		try {
			// Recreate the full XDG_CONFIG_HOME/ralph-for-kiro path so
			// resolveUserDir sees an existing directory.
			const { mkdir } = await import("node:fs/promises");
			await mkdir(join(xdg, "ralph-for-kiro"), { recursive: true });
			process.env["XDG_CONFIG_HOME"] = xdg;
			expect(resolveUserDir()).toBe(resolve(xdg, "ralph-for-kiro"));
		} finally {
			await rm(xdg, { recursive: true, force: true });
		}
	});

	test("XDG default is ignored when its directory does not exist", () => {
		process.env["XDG_CONFIG_HOME"] = "/definitely/does/not/exist/anywhere";
		// Should fall through to cwd.
		expect(resolveUserDir()).toBe(originalCwd);
	});

	test("scoutsDir, resultsDir, watchManifestFile all follow the active user dir", async () => {
		const tmp = await mkdtemp(join(tmpdir(), "ralph-paths-"));
		try {
			setUserDir(tmp);
			expect(getUserDir()).toBe(resolve(tmp));
			expect(scoutsDir()).toBe(join(resolve(tmp), "scouts"));
			expect(resultsDir()).toBe(join(resolve(tmp), "results"));
			expect(watchManifestFile()).toBe(
				join(resolve(tmp), "watch-manifest.json"),
			);
		} finally {
			await rm(tmp, { recursive: true, force: true });
		}
	});
});
