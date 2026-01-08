import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the project root directory (where src/index.ts lives)
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const indexPath = join(projectRoot, "src/index.ts");

describe("init command", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ralph-test-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("creates agent and steering files", async () => {
		const proc = Bun.spawn(["bun", "run", indexPath, "init"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		await proc.exited;

		const agentPath = join(testDir, ".kiro/agents/ralph-wiggum.json");
		const steeringPath = join(testDir, ".kiro/steering/ralph-context.md");

		expect(await Bun.file(agentPath).exists()).toBe(true);
		expect(await Bun.file(steeringPath).exists()).toBe(true);
	});

	test("refuses to overwrite without --force", async () => {
		// First init
		await Bun.spawn(["bun", "run", indexPath, "init"], {
			cwd: testDir,
		}).exited;

		// Second init should fail
		const proc = Bun.spawn(["bun", "run", indexPath, "init"], {
			cwd: testDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(output).toContain("already exist");
		expect(output).toContain("--force");
	});
});

describe("cancel command", () => {
	test("handles no active loop gracefully", async () => {
		const testDir = join(tmpdir(), `ralph-cancel-${Date.now()}`);
		await mkdir(testDir, { recursive: true });

		const proc = Bun.spawn(["bun", "run", indexPath, "cancel"], {
			cwd: testDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(output).toContain("No active Ralph loop found");

		await rm(testDir, { recursive: true, force: true });
	});
});
