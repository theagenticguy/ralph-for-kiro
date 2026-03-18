/**
 * @fileoverview Watch-specific runner that wraps the loop runner.
 * Manages task IDs, results folders, manifest reading, and prompt building.
 * @module core/watch-runner
 */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "@clack/prompts";
import pc from "picocolors";
import { LoopConfigSchema } from "../schemas/config";
import { type WatchManifest, WatchManifestSchema } from "../schemas/manifest";
import { type WatchStatus, WatchStatusSchema } from "../schemas/results";
import {
	RESULTS_DIR,
	WATCH_AGENT_NAME,
	WATCH_MANIFEST_FILE,
} from "../utils/paths";
import { runLoop } from "./loop-runner";

/**
 * Options for a watch run.
 */
export interface WatchRunOptions {
	/** Minimum iterations before checking completion */
	minIterations: number;
	/** Maximum iterations */
	maxIterations: number;
	/** Optional agent name override */
	agentName?: string | null;
}

/**
 * Generates a task ID based on the current timestamp.
 * Format: pw-YYYYMMDD-HHmm
 */
export function generateTaskId(): string {
	const now = new Date();
	const date = now.toISOString().slice(0, 10).replace(/-/g, "");
	const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
	return `pw-${date}-${time}`;
}

/**
 * Reads and validates the watch manifest file.
 */
export async function readManifest(): Promise<WatchManifest> {
	const file = Bun.file(WATCH_MANIFEST_FILE);

	if (!(await file.exists())) {
		throw new Error(
			`Watch manifest not found at ${WATCH_MANIFEST_FILE}\nRun 'ralph watch init' first.`,
		);
	}

	const content = await file.json();
	return WatchManifestSchema.parse(content);
}

/**
 * Builds the prompt for the Kiro agent from the manifest.
 */
function buildWatchPrompt(
	manifest: WatchManifest,
	taskId: string,
	resultsPath: string,
): string {
	const watchedRepos = manifest.watch
		.map((w) => `  - ${w.repo} (${w.tags.join(", ")})`)
		.join("\n");

	return `You are running a Project Watcher discovery scan.

TASK ID: ${taskId}
RESULTS FOLDER: ${resultsPath}

Write all output files to the results folder above. Create the iterations/ subdirectory as needed.

WATCH MANIFEST:
- Topics: ${manifest.topics.join(", ")}
- Languages: ${manifest.languages.join(", ")}
- Min stars threshold: ${manifest.thresholds.minStars}
- Auto-add threshold: ${manifest.thresholds.autoAddStars}
- Max repo age: ${manifest.thresholds.maxAgeDays} days
- Currently watching:
${watchedRepos || "  (none)"}

Search for trending GitHub repositories matching these topics using all available MCP tools (@exa, @brave-search, @tavily). Follow the iterative deepening strategy in your steering file.

Read .kiro/ralph-loop.local.json for iteration state and previous feedback.`;
}

/**
 * Writes or updates the status file for a watch run.
 */
async function writeStatus(
	resultsPath: string,
	status: WatchStatus,
): Promise<void> {
	const statusPath = join(resultsPath, "status.json");
	await Bun.write(statusPath, JSON.stringify(status, null, 2));
}

/**
 * Runs a watch discovery loop.
 */
export async function runWatch(opts: WatchRunOptions): Promise<void> {
	// Read manifest
	const manifest = await readManifest();

	// Generate task ID and create results folder
	const taskId = generateTaskId();
	const resultsPath = join(RESULTS_DIR, taskId);
	const iterationsPath = join(resultsPath, "iterations");

	await mkdir(iterationsPath, { recursive: true });

	// Write initial status
	const status: WatchStatus = {
		taskId,
		status: "running",
		startedAt: new Date().toISOString(),
		completedAt: null,
		currentIteration: 0,
		maxIterations: opts.maxIterations,
		reposDiscovered: 0,
		reposAdded: 0,
		error: null,
	};
	await writeStatus(resultsPath, status);

	// Display startup info
	log.info(pc.bold(pc.blue("Project Watcher starting")));
	log.message(`   Task ID: ${pc.green(taskId)}`);
	log.message(`   Topics: ${manifest.topics.join(", ")}`);
	log.message(`   Languages: ${manifest.languages.join(", ")}`);
	log.message(`   Results: ${resultsPath}`);
	log.message(`   Iterations: ${opts.minIterations}-${opts.maxIterations}`);
	console.log();

	// Build the prompt
	const prompt = buildWatchPrompt(manifest, taskId, resultsPath);

	// Validate and run the loop
	const config = LoopConfigSchema.parse({
		prompt,
		minIterations: opts.minIterations,
		maxIterations: opts.maxIterations,
		completionPromise: "COMPLETE",
		agentName: opts.agentName ?? WATCH_AGENT_NAME,
	});

	try {
		const result = await runLoop(config);

		// Update status based on loop result
		status.status = "complete";
		status.completedAt = new Date().toISOString();
		status.currentIteration = result.iteration;
		await writeStatus(resultsPath, status);

		log.success(
			pc.green(`Watch run ${result.reason} at iteration ${result.iteration}`),
		);
		log.message(`Results: ${resultsPath}`);
	} catch (error) {
		// Update status on failure
		status.status = "failed";
		status.completedAt = new Date().toISOString();
		status.error = error instanceof Error ? error.message : String(error);
		await writeStatus(resultsPath, status);
		throw error;
	}
}

/**
 * Reads the status file for a given task ID.
 */
export async function readStatus(taskId: string): Promise<WatchStatus | null> {
	const statusPath = join(RESULTS_DIR, taskId, "status.json");
	const file = Bun.file(statusPath);

	if (!(await file.exists())) {
		return null;
	}

	const content = await file.json();
	return WatchStatusSchema.parse(content);
}

/**
 * Reads the summary file for a given task ID.
 */
export async function readSummary(taskId: string): Promise<string | null> {
	const summaryPath = join(RESULTS_DIR, taskId, "summary.md");
	const file = Bun.file(summaryPath);

	if (!(await file.exists())) {
		return null;
	}

	return file.text();
}

/**
 * Lists all watch runs in the results directory.
 */
export async function listRuns(): Promise<WatchStatus[]> {
	// Check if results directory exists
	try {
		await readdir(RESULTS_DIR);
	} catch {
		return [];
	}

	const entries = await readdir(RESULTS_DIR);
	const runs: WatchStatus[] = [];

	for (const entry of entries) {
		if (!entry.startsWith("pw-")) continue;

		const statusPath = join(RESULTS_DIR, entry, "status.json");
		const statusFile = Bun.file(statusPath);

		if (await statusFile.exists()) {
			try {
				const content = await statusFile.json();
				runs.push(WatchStatusSchema.parse(content));
			} catch {
				// Skip invalid status files
			}
		}
	}

	// Sort by start time, most recent first
	runs.sort(
		(a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
	);

	return runs;
}
