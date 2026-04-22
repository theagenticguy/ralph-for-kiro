/**
 * @fileoverview Watch command for Ralph Wiggum CLI.
 * Discovers trending repos through iterative deep research.
 * @module commands/watch
 */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "@clack/prompts";
import pc from "picocolors";
import { installHookScripts } from "../core/hook-installer";
import {
	listRuns,
	readStatus,
	readSummary,
	runWatch,
} from "../core/watch-runner";
import agentConfig from "../data/project-watcher.json";
import steeringContent from "../data/watcher-context.md" with { type: "text" };
import {
	KIRO_AGENTS_DIR,
	KIRO_SETTINGS_DIR,
	KIRO_STEERING_DIR,
	resultsDir,
	watchManifestFile,
} from "../utils/paths";

/**
 * CLI options for the watch run command.
 */
interface WatchRunOptions {
	minIterations: string;
	maxIterations: string;
	agent?: string;
	manifest?: string;
	scout?: string;
}

/**
 * CLI options for the watch init command.
 */
interface WatchInitOptions {
	force?: boolean;
}

/**
 * Runs a watch discovery loop.
 * Default action when `ralph watch` is invoked without subcommand.
 */
export async function watchRunCommand(opts: WatchRunOptions): Promise<void> {
	const minIterations = Number.parseInt(opts.minIterations, 10);
	const maxIterations = Number.parseInt(opts.maxIterations, 10);

	if (Number.isNaN(minIterations) || minIterations < 1) {
		log.error(pc.red("Invalid --min-iterations value"));
		process.exit(1);
	}
	if (Number.isNaN(maxIterations) || maxIterations < 1) {
		log.error(pc.red("Invalid --max-iterations value"));
		process.exit(1);
	}

	await runWatch({
		minIterations,
		maxIterations,
		agentName: opts.agent ?? null,
		manifestPath: opts.manifest ?? null,
		scoutName: opts.scout ?? null,
	});
}

/**
 * Initializes watch configuration files.
 */
export async function watchInitCommand(opts: WatchInitOptions): Promise<void> {
	const agentPath = join(KIRO_AGENTS_DIR, "project-watcher.json");
	const steeringPath = join(KIRO_STEERING_DIR, "watcher-context.md");
	const mcpSourcePath = ".mcp.json.example";
	const mcpTargetPath = join(KIRO_SETTINGS_DIR, "mcp.json");
	const manifestSourcePath = "watch-manifest.example.json";

	// Check for existing files
	if (!opts.force) {
		const existing: string[] = [];
		if (await Bun.file(agentPath).exists()) existing.push(agentPath);
		if (await Bun.file(steeringPath).exists()) existing.push(steeringPath);

		if (existing.length > 0) {
			log.error(pc.red("Files already exist:"));
			for (const f of existing) {
				log.message(`  - ${f}`);
			}
			log.message(`\nUse ${pc.bold("--force")} to overwrite.`);
			return;
		}
	}

	// Create directories
	await mkdir(KIRO_AGENTS_DIR, { recursive: true });
	await mkdir(KIRO_STEERING_DIR, { recursive: true });
	await mkdir(KIRO_SETTINGS_DIR, { recursive: true });
	await mkdir(resultsDir(), { recursive: true });

	// Write agent config
	await Bun.write(agentPath, `${JSON.stringify(agentConfig, null, 2)}\n`);
	log.success(`${pc.green("Created")} ${agentPath}`);

	// Write steering file
	await Bun.write(steeringPath, steeringContent);
	log.success(`${pc.green("Created")} ${steeringPath}`);

	// Stamp lifecycle hook scripts alongside the agent.
	const hookPaths = await installHookScripts();
	for (const p of hookPaths) {
		log.success(`${pc.green("Created")} ${p}`);
	}

	// Copy MCP config if it doesn't exist
	if (!(await Bun.file(mcpTargetPath).exists())) {
		const mcpSource = Bun.file(mcpSourcePath);
		if (await mcpSource.exists()) {
			const mcpContent = await mcpSource.text();
			await Bun.write(mcpTargetPath, mcpContent);
			log.success(`${pc.green("Created")} ${mcpTargetPath}`);
			log.message(
				pc.dim(
					"  Edit this file to add your API keys (BRAVE_API_KEY, TAVILY_API_KEY, EXA_API_KEY)",
				),
			);
		}
	} else {
		log.message(pc.dim(`  ${mcpTargetPath} already exists, skipping`));
	}

	// Copy manifest if it doesn't exist
	if (!(await Bun.file(watchManifestFile()).exists())) {
		const manifestSource = Bun.file(manifestSourcePath);
		if (await manifestSource.exists()) {
			const manifestContent = await manifestSource.text();
			await Bun.write(watchManifestFile(), manifestContent);
			log.success(`${pc.green("Created")} ${watchManifestFile()}`);
			log.message(pc.dim("  Edit this file to set your topics and languages"));
		}
	} else {
		log.message(pc.dim(`  ${watchManifestFile()} already exists, skipping`));
	}

	// Success message
	console.log();
	log.success(pc.bold(pc.green("Project Watcher initialized!")));
	console.log();
	log.message("Next steps:");
	log.message(
		pc.dim("  1. Edit watch-manifest.json to set your topics and languages"),
	);
	log.message(pc.dim("  2. Edit .kiro/settings/mcp.json with your API keys"));
	log.message(pc.dim("  3. Run: ralph watch"));
}

/**
 * Displays results for a specific watch run.
 */
export async function watchResultsCommand(taskId?: string): Promise<void> {
	let targetId = taskId;

	// If no ID provided, find the most recent run
	if (!targetId) {
		const runs = await listRuns();
		if (runs.length === 0) {
			log.message("No watch runs found. Run 'ralph watch' to start one.");
			return;
		}
		const latest = runs[0];
		if (!latest) {
			log.message("No watch runs found.");
			return;
		}
		targetId = latest.taskId;
		log.message(pc.dim(`Showing most recent run: ${targetId}`));
		console.log();
	}

	// Read status
	const status = await readStatus(targetId);
	if (!status) {
		log.error(pc.red(`No results found for task ${targetId}`));
		return;
	}

	// Display status
	const statusColor =
		status.status === "complete"
			? pc.green
			: status.status === "failed"
				? pc.red
				: pc.yellow;

	log.info(pc.bold(`Task: ${status.taskId}`));
	log.message(`   Status: ${statusColor(status.status)}`);
	log.message(`   Started: ${status.startedAt}`);
	if (status.completedAt) {
		log.message(`   Completed: ${status.completedAt}`);
	}
	log.message(
		`   Iterations: ${status.currentIteration}/${status.maxIterations}`,
	);
	log.message(`   Repos discovered: ${status.reposDiscovered}`);
	log.message(`   Repos added: ${status.reposAdded}`);

	if (status.error) {
		log.error(pc.red(`   Error: ${status.error}`));
	}

	// Show summary if complete
	if (status.status === "complete") {
		const summary = await readSummary(targetId);
		if (summary) {
			console.log();
			log.info(pc.bold("Summary:"));
			console.log(summary);
		}
	}

	// Show iteration files
	const iterationsDir = join(resultsDir(), targetId, "iterations");
	try {
		const files = await readdir(iterationsDir);
		if (files.length > 0) {
			console.log();
			log.message(pc.dim(`Iteration snapshots in ${iterationsDir}:`));
			for (const f of files.sort()) {
				log.message(pc.dim(`  - ${f}`));
			}
		}
	} catch {
		// No iterations dir yet
	}
}

/**
 * Lists recent watch runs.
 */
export async function watchLsCommand(): Promise<void> {
	const runs = await listRuns();

	if (runs.length === 0) {
		log.message("No watch runs found. Run 'ralph watch' to start one.");
		return;
	}

	log.info(pc.bold(`${runs.length} watch run(s):`));
	console.log();

	for (const run of runs) {
		const statusColor =
			run.status === "complete"
				? pc.green
				: run.status === "failed"
					? pc.red
					: pc.yellow;

		const date = new Date(run.startedAt).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});

		log.message(
			`  ${pc.bold(run.taskId)}  ${statusColor(run.status.padEnd(8))}  ${date}  ${run.reposDiscovered} repos`,
		);
	}
}
