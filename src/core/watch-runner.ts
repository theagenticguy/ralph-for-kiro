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
	/** Optional manifest file path override */
	manifestPath?: string | null;
	/** Optional scout name for results namespacing */
	scoutName?: string | null;
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
 * Reads and validates a watch manifest file.
 */
export async function readManifest(
	manifestPath?: string | null,
): Promise<WatchManifest> {
	const path = manifestPath ?? WATCH_MANIFEST_FILE;
	const file = Bun.file(path);

	if (!(await file.exists())) {
		throw new Error(
			`Watch manifest not found at ${path}\nRun 'ralph watch init' first.`,
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
	manifestPath: string,
): string {
	const watchedRepos = manifest.watch
		.map((w) => `  - ${w.repo} (${w.tags.join(", ")})`)
		.join("\n");

	return `You are running a Project Watcher discovery scan.

TASK ID: ${taskId}
RESULTS FOLDER: ${resultsPath}
MANIFEST FILE: ${manifestPath}

Write all output files to the results folder above. Create the iterations/ subdirectory as needed.
Write manifest updates (auto-add, freshness tracking, discovery log) back to the MANIFEST FILE path above.

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
	const manifest = await readManifest(opts.manifestPath);

	// Generate task ID and create results folder
	// When running as a scout, namespace results under the scout name
	const taskId = generateTaskId();
	const resultsBase = opts.scoutName
		? join(RESULTS_DIR, opts.scoutName)
		: RESULTS_DIR;
	const resultsPath = join(resultsBase, taskId);
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
	const label = opts.scoutName
		? `Scout [${opts.scoutName}] starting`
		: "Project Watcher starting";
	log.info(pc.bold(pc.blue(label)));
	if (opts.scoutName) {
		log.message(`   Scout: ${pc.cyan(opts.scoutName)}`);
	}
	log.message(`   Task ID: ${pc.green(taskId)}`);
	log.message(`   Topics: ${manifest.topics.join(", ")}`);
	log.message(`   Languages: ${manifest.languages.join(", ")}`);
	log.message(`   Results: ${resultsPath}`);
	log.message(`   Iterations: ${opts.minIterations}-${opts.maxIterations}`);
	console.log();

	// Build the prompt
	const manifestFilePath = opts.manifestPath ?? WATCH_MANIFEST_FILE;
	const prompt = buildWatchPrompt(
		manifest,
		taskId,
		resultsPath,
		manifestFilePath,
	);

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
export async function readStatus(
	taskId: string,
	scoutName?: string | null,
): Promise<WatchStatus | null> {
	const base = scoutName ? join(RESULTS_DIR, scoutName) : RESULTS_DIR;
	const statusPath = join(base, taskId, "status.json");
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
export async function readSummary(
	taskId: string,
	scoutName?: string | null,
): Promise<string | null> {
	const base = scoutName ? join(RESULTS_DIR, scoutName) : RESULTS_DIR;
	const summaryPath = join(base, taskId, "summary.md");
	const file = Bun.file(summaryPath);

	if (!(await file.exists())) {
		return null;
	}

	return file.text();
}

/**
 * A run entry with optional scout name.
 */
export interface WatchRunEntry extends WatchStatus {
	scoutName?: string;
}

/**
 * Lists watch runs, optionally filtered by scout name.
 */
export async function listRuns(
	scoutName?: string | null,
): Promise<WatchRunEntry[]> {
	const base = scoutName ? join(RESULTS_DIR, scoutName) : RESULTS_DIR;

	// Check if directory exists
	try {
		await readdir(base);
	} catch {
		return [];
	}

	const entries = await readdir(base);
	const runs: WatchRunEntry[] = [];

	for (const entry of entries) {
		if (!entry.startsWith("pw-")) continue;

		const statusPath = join(base, entry, "status.json");
		const statusFile = Bun.file(statusPath);

		if (await statusFile.exists()) {
			try {
				const content = await statusFile.json();
				const status = WatchStatusSchema.parse(content);
				runs.push({ ...status, scoutName: scoutName ?? undefined });
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
