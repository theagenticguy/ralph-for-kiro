import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("KiroClient", () => {
	describe("constructor", () => {
		test("throws when agent config file does not exist", async () => {
			// Save original cwd and change to a temp directory without config
			const tempDir = await mkdtemp(join(tmpdir(), "kiro-test-"));
			const originalCwd = process.cwd();

			try {
				process.chdir(tempDir);

				// Dynamically import to get fresh module state
				// The KiroClient checks for config at construction time
				const { KiroClient } = await import("../src/core/kiro-client.ts");

				expect(() => new KiroClient()).toThrow(/Agent config not found/);
			} finally {
				process.chdir(originalCwd);
				await rm(tempDir, { recursive: true, force: true });
			}
		});

		test("uses provided agent name without checking config", async () => {
			// When an agent name is explicitly provided, it should use that
			// without checking for the default config file
			const tempDir = await mkdtemp(join(tmpdir(), "kiro-test-"));
			const originalCwd = process.cwd();

			try {
				process.chdir(tempDir);

				const { KiroClient } = await import("../src/core/kiro-client.ts");

				// Should not throw because we're providing an explicit agent name
				const client = new KiroClient("custom-agent");
				expect(client).toBeDefined();
			} finally {
				process.chdir(originalCwd);
				await rm(tempDir, { recursive: true, force: true });
			}
		});

		test("uses default agent name when config exists", async () => {
			const tempDir = await mkdtemp(join(tmpdir(), "kiro-test-"));
			const originalCwd = process.cwd();

			try {
				process.chdir(tempDir);

				// Create the config directory and file
				const configDir = join(tempDir, ".kiro", "agents");
				await mkdir(configDir, { recursive: true });
				await writeFile(
					join(configDir, "ralph-wiggum.json"),
					JSON.stringify({ name: "ralph-wiggum" }),
				);

				const { KiroClient } = await import("../src/core/kiro-client.ts");

				// Should not throw because config exists
				const client = new KiroClient();
				expect(client).toBeDefined();
			} finally {
				process.chdir(originalCwd);
				await rm(tempDir, { recursive: true, force: true });
			}
		});
	});
});

describe("session-reader", () => {
	describe("getLatestSession", () => {
		test("returns null when database does not exist", async () => {
			// Import the function
			const { getLatestSession } = await import(
				"../src/core/session-reader.ts"
			);

			// Use a non-existent directory to ensure DB doesn't exist
			const result = getLatestSession("/non/existent/directory");

			// Should return null when DB doesn't exist
			expect(result).toBeNull();
		});

		test("returns null for directory with no sessions", async () => {
			const { getLatestSession } = await import(
				"../src/core/session-reader.ts"
			);

			// Query for a directory that definitely has no sessions
			const result = getLatestSession("/some/random/path/that/has/no/sessions");

			// Should return null (either DB doesn't exist or no matching sessions)
			expect(result).toBeNull();
		});
	});
});
