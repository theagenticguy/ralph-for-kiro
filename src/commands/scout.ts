/**
 * @fileoverview Scout command for Ralph Wiggum CLI.
 * Manages a fleet of focused discovery scouts, each with its own manifest.
 * @module commands/scout
 */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "@clack/prompts";
import pc from "picocolors";
import {
	listRuns,
	readManifest,
	runWatch,
	type WatchRunEntry,
} from "../core/watch-runner";
import { SCOUTS_DIR } from "../utils/paths";

/**
 * A scout definition derived from its directory and manifest.
 */
interface ScoutInfo {
	/** Scout name (directory name) */
	name: string;
	/** Path to the scout's manifest file */
	manifestPath: string;
	/** Topics from the manifest */
	topics: string[];
	/** Languages from the manifest */
	languages: string[];
	/** Number of watched repos */
	watchCount: number;
}

/**
 * CLI options for the scout run command.
 */
interface ScoutRunOptions {
	name?: string;
	minIterations: string;
	maxIterations: string;
	agent?: string;
}

/**
 * Discovers all scouts in the scouts/ directory.
 * Each subdirectory with a manifest.json is a scout.
 */
async function discoverScouts(): Promise<ScoutInfo[]> {
	try {
		await readdir(SCOUTS_DIR);
	} catch {
		return [];
	}

	const entries = await readdir(SCOUTS_DIR, { withFileTypes: true });
	const scouts: ScoutInfo[] = [];

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const manifestPath = join(SCOUTS_DIR, entry.name, "manifest.json");
		try {
			const manifest = await readManifest(manifestPath);
			scouts.push({
				name: entry.name,
				manifestPath,
				topics: manifest.topics,
				languages: manifest.languages,
				watchCount: manifest.watch.length,
			});
		} catch {
			// Skip directories without valid manifests
		}
	}

	return scouts.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Runs one or all scouts sequentially.
 */
export async function scoutRunCommand(opts: ScoutRunOptions): Promise<void> {
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

	const allScouts = await discoverScouts();

	if (allScouts.length === 0) {
		log.error(
			pc.red(
				`No scouts found in ${SCOUTS_DIR}/\nRun 'ralph scout init <name>' to create one.`,
			),
		);
		return;
	}

	// Filter to a specific scout if --name is given
	const scouts = opts.name
		? allScouts.filter((s) => s.name === opts.name)
		: allScouts;

	if (opts.name && scouts.length === 0) {
		log.error(
			pc.red(
				`Scout "${opts.name}" not found. Available: ${allScouts.map((s) => s.name).join(", ")}`,
			),
		);
		return;
	}

	log.info(pc.bold(pc.blue(`Deploying ${scouts.length} scout(s)`)));
	console.log();

	const results: { name: string; ok: boolean; error?: string }[] = [];

	for (const scout of scouts) {
		log.info(pc.bold(`Scout [${pc.cyan(scout.name)}]`));
		log.message(pc.dim(`   Topics: ${scout.topics.join(", ")}`));
		log.message(pc.dim(`   Watching: ${scout.watchCount} repos`));
		console.log();

		try {
			await runWatch({
				minIterations,
				maxIterations,
				agentName: opts.agent ?? null,
				manifestPath: scout.manifestPath,
				scoutName: scout.name,
			});
			results.push({ name: scout.name, ok: true });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			log.error(pc.red(`Scout [${scout.name}] failed: ${msg}`));
			results.push({ name: scout.name, ok: false, error: msg });
		}

		console.log();
	}

	// Summary
	const succeeded = results.filter((r) => r.ok).length;
	const failed = results.filter((r) => !r.ok).length;

	log.info(pc.bold("Fleet Summary"));
	log.message(
		`   ${pc.green(`${succeeded} succeeded`)}${failed > 0 ? `, ${pc.red(`${failed} failed`)}` : ""}`,
	);
}

/**
 * Lists all available scouts and their configuration.
 */
export async function scoutLsCommand(): Promise<void> {
	const scouts = await discoverScouts();

	if (scouts.length === 0) {
		log.message(
			`No scouts found in ${SCOUTS_DIR}/. Run 'ralph scout init <name>' to create one.`,
		);
		return;
	}

	log.info(pc.bold(`${scouts.length} scout(s):`));
	console.log();

	for (const scout of scouts) {
		log.message(
			`  ${pc.bold(pc.cyan(scout.name))}  ${scout.topics.join(", ")}  (${scout.watchCount} repos)`,
		);
		log.message(pc.dim(`    ${scout.manifestPath}`));
	}
}

/**
 * Shows results for a specific scout.
 */
export async function scoutResultsCommand(name?: string): Promise<void> {
	if (!name) {
		// Show latest run across all scouts
		const scouts = await discoverScouts();
		if (scouts.length === 0) {
			log.message("No scouts found.");
			return;
		}

		const allRuns: WatchRunEntry[] = [];
		for (const scout of scouts) {
			const runs = await listRuns(scout.name);
			allRuns.push(...runs);
		}

		if (allRuns.length === 0) {
			log.message("No runs found across any scouts.");
			return;
		}

		// Sort all runs by start time
		allRuns.sort(
			(a, b) =>
				new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
		);

		log.info(pc.bold("Recent runs across all scouts:"));
		console.log();

		for (const run of allRuns.slice(0, 10)) {
			const statusColor =
				run.status === "complete"
					? pc.green
					: run.status === "failed"
						? pc.red
						: pc.yellow;
			const scoutLabel = run.scoutName ? pc.cyan(`[${run.scoutName}]`) : "";

			const date = new Date(run.startedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});

			log.message(
				`  ${scoutLabel} ${pc.bold(run.taskId)}  ${statusColor(run.status.padEnd(8))}  ${date}`,
			);
		}
		return;
	}

	// Show runs for a specific scout
	const runs = await listRuns(name);
	if (runs.length === 0) {
		log.message(`No runs found for scout "${name}".`);
		return;
	}

	log.info(pc.bold(`Runs for scout [${pc.cyan(name)}]:`));
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

/**
 * Scaffolds a new scout with an empty manifest.
 */
export async function scoutInitCommand(
	name: string,
	opts: { topics?: string; languages?: string; force?: boolean },
): Promise<void> {
	const scoutDir = join(SCOUTS_DIR, name);
	const manifestPath = join(scoutDir, "manifest.json");

	// Check for existing
	if (!opts.force) {
		try {
			if (await Bun.file(manifestPath).exists()) {
				log.error(
					pc.red(
						`Scout "${name}" already exists at ${manifestPath}. Use --force to overwrite.`,
					),
				);
				return;
			}
		} catch {
			// Doesn't exist, good
		}
	}

	await mkdir(scoutDir, { recursive: true });

	const topics = opts.topics
		? opts.topics.split(",").map((t) => t.trim())
		: [name];
	const languages = opts.languages
		? opts.languages.split(",").map((l) => l.trim())
		: ["python", "typescript", "rust"];

	const manifest = {
		version: "1.0",
		topics,
		languages,
		watch: [],
		thresholds: {
			minStars: 50,
			autoAddStars: 500,
			maxAgeDays: 30,
		},
		discoveryLog: [],
	};

	await Bun.write(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);

	log.success(
		`${pc.green("Created")} scout ${pc.cyan(name)} at ${manifestPath}`,
	);
	log.message(pc.dim(`  Topics: ${topics.join(", ")}`));
	log.message(pc.dim(`  Languages: ${languages.join(", ")}`));
	log.message(pc.dim(`\n  Run: ralph scout run --name ${name}`));
}
