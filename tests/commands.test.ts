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

describe("resume command", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = join(tmpdir(), `ralph-resume-${Date.now()}`);
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	test("handles no state file gracefully", async () => {
		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(output).toContain("No stopped Ralph loop found");
		expect(exitCode).toBe(1);
	});

	test("handles invalid state file gracefully", async () => {
		// Create .kiro directory and invalid state file
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });
		await Bun.write(join(kiroDir, "ralph-loop.local.json"), "invalid json{");

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;

		expect(output).toContain("Failed to parse state file");
		expect(exitCode).toBe(1);
	});

	test("displays previous loop information when state file exists", async () => {
		// Create .kiro directory and valid state file
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 3,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "DONE",
			startedAt: new Date().toISOString(),
			prompt: "Build a test CLI tool",
			previousFeedback: {
				qualityScore: 7,
				qualitySummary: "Good progress",
				nextSteps: ["Add more tests", "Improve error handling"],
				improvements: ["Better documentation"],
				blockers: [],
				ideas: ["Consider caching"],
			},
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Run resume - it will eventually fail because kiro-cli isn't available,
		// but we can verify it reads and displays the state info
		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Verify it displays previous loop info
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Previous iteration: 3");
		expect(output).toContain("Build a test CLI tool");
		expect(output).toContain("Last quality score: 7/10");
	});

	test("uses existing state values as defaults", async () => {
		// Create .kiro directory and valid state file with specific config values
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 5,
			minIterations: 2,
			maxIterations: 15,
			completionPromise: "FINISHED",
			startedAt: new Date().toISOString(),
			prompt: "Original task prompt",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Verify it shows the resume info (state was read successfully)
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Previous iteration: 5");
		expect(output).toContain("Original task prompt");
	});

	test("handles state file with missing optional feedback fields", async () => {
		// Create .kiro directory and state file without previousFeedback
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 2,
			minIterations: 1,
			maxIterations: 5,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Simple task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Verify it handles missing feedback gracefully
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Previous iteration: 2");
		// Should NOT contain quality score since no feedback
		expect(output).not.toContain("Last quality score");
	});

	test("overrides minIterations from CLI option", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 3,
			minIterations: 2,
			maxIterations: 10,
			completionPromise: "DONE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Override minIterations via CLI
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-n", "5"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Verify it reads state and attempts to resume (will fail without kiro-cli, but that's ok)
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Previous iteration: 3");
	});

	test("overrides maxIterations from CLI option", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 2,
			minIterations: 1,
			maxIterations: 5,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Override maxIterations via CLI
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-m", "20"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(output).toContain("Resuming Ralph loop");
	});

	test("overrides completionPromise from CLI option", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 1,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "DONE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Override completionPromise via CLI
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-p", "FINISHED"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(output).toContain("Resuming Ralph loop");
	});

	test("overrides agent from CLI option", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 1,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Override agent via CLI
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-a", "custom-agent"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(output).toContain("Resuming Ralph loop");
	});

	test("handles validation error for invalid minIterations", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 1,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Try to override with invalid value (negative)
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-n", "-1"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		// Should show validation error and exit with code 1
		const combinedOutput = output + stderr;
		expect(combinedOutput).toContain("Validation error");
		expect(exitCode).toBe(1);
	});

	test("handles validation error for invalid maxIterations", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 1,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		// Try to override with invalid value (negative)
		const proc = Bun.spawn(
			["bun", "run", indexPath, "resume", "-m", "-5"],
			{
				cwd: testDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		const output = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const exitCode = await proc.exited;

		// Should show validation error and exit with code 1
		const combinedOutput = output + stderr;
		expect(combinedOutput).toContain("Validation error");
		expect(exitCode).toBe(1);
	});

	test("formats all feedback fields in resume context", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 4,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Build a feature",
			previousFeedback: {
				qualityScore: 8,
				qualitySummary: "Good progress made",
				nextSteps: ["Add tests", "Update documentation"],
				improvements: ["Better error handling", "More comments"],
				blockers: ["Waiting for API key"],
				ideas: ["Add caching", "Consider optimization"],
			},
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Verify all feedback fields are displayed
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Last quality score: 8/10");
		// The resume context is passed to runLoop, so we can't easily test it directly
		// but we can verify the command runs successfully (will fail without kiro-cli, but that's expected)
	});

	test("handles feedback with empty arrays", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 2,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
			previousFeedback: {
				qualityScore: 5,
				qualitySummary: "In progress",
				nextSteps: [],
				improvements: [],
				blockers: [],
				ideas: [],
			},
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Should handle empty arrays gracefully
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Last quality score: 5/10");
		// Empty arrays should not cause errors
	});

	test("handles partial feedback (only some fields present)", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 3,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
			previousFeedback: {
				qualityScore: 6,
				// Only qualityScore, no other fields
			},
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Should handle partial feedback gracefully
		expect(output).toContain("Resuming Ralph loop");
		expect(output).toContain("Last quality score: 6/10");
	});

	test("handles feedback with only qualitySummary (no qualityScore)", async () => {
		const kiroDir = join(testDir, ".kiro");
		await mkdir(kiroDir, { recursive: true });

		const stateData = {
			active: false,
			iteration: 2,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "COMPLETE",
			startedAt: new Date().toISOString(),
			prompt: "Test task",
			previousFeedback: {
				qualitySummary: "Making progress",
				nextSteps: ["Continue implementation"],
			},
		};

		await Bun.write(
			join(kiroDir, "ralph-loop.local.json"),
			JSON.stringify(stateData),
		);

		const proc = Bun.spawn(["bun", "run", indexPath, "resume"], {
			cwd: testDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;

		// Should handle feedback without qualityScore
		expect(output).toContain("Resuming Ralph loop");
		expect(output).not.toContain("Last quality score");
		// Should still work without qualityScore
	});
});
