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
import { RESULTS_DIR, SCOUTS_DIR } from "../utils/paths";

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
	concurrency?: string;
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

	const concurrency = Math.max(
		1,
		Number.parseInt(opts.concurrency ?? "1", 10) || 1,
	);

	log.info(
		pc.bold(
			pc.blue(
				`Deploying ${scouts.length} scout(s)${concurrency > 1 ? ` (concurrency=${concurrency})` : ""}`,
			),
		),
	);
	console.log();

	const results = await runScoutsWithConcurrency(scouts, concurrency, {
		minIterations,
		maxIterations,
		agentName: opts.agent ?? null,
	});

	// Summary
	const succeeded = results.filter((r) => r.ok).length;
	const failed = results.filter((r) => !r.ok).length;

	log.info(pc.bold("Fleet Summary"));
	log.message(
		`   ${pc.green(`${succeeded} succeeded`)}${failed > 0 ? `, ${pc.red(`${failed} failed`)}` : ""}`,
	);
	for (const r of results) {
		if (!r.ok) {
			log.message(
				pc.dim(`   ${pc.red("✗")} ${r.name}: ${r.error ?? "unknown"}`),
			);
		}
	}
}

interface ScoutRunContext {
	minIterations: number;
	maxIterations: number;
	agentName: string | null;
}

interface ScoutRunResult {
	name: string;
	ok: boolean;
	error?: string;
}

/**
 * Drain a list of scouts into N parallel workers. Each worker pulls the next
 * available scout off a shared queue and runs it to completion before pulling
 * the next one. Errors are caught per-scout so one failure never aborts the
 * fleet.
 */
async function runScoutsWithConcurrency(
	scouts: ScoutInfo[],
	concurrency: number,
	ctx: ScoutRunContext,
): Promise<ScoutRunResult[]> {
	const queue = [...scouts];
	const results: ScoutRunResult[] = [];
	const workers: Promise<void>[] = [];
	const workerCount = Math.min(concurrency, scouts.length);

	for (let i = 0; i < workerCount; i++) {
		workers.push(
			(async () => {
				while (queue.length > 0) {
					const scout = queue.shift();
					if (!scout) break;

					log.info(pc.bold(`Scout [${pc.cyan(scout.name)}]`));
					log.message(pc.dim(`   Topics: ${scout.topics.join(", ")}`));
					log.message(pc.dim(`   Watching: ${scout.watchCount} repos`));

					try {
						await runWatch({
							minIterations: ctx.minIterations,
							maxIterations: ctx.maxIterations,
							agentName: ctx.agentName,
							manifestPath: scout.manifestPath,
							scoutName: scout.name,
						});
						results.push({ name: scout.name, ok: true });
					} catch (error) {
						const msg = error instanceof Error ? error.message : String(error);
						log.error(pc.red(`Scout [${scout.name}] failed: ${msg}`));
						results.push({ name: scout.name, ok: false, error: msg });
					}
				}
			})(),
		);
	}

	await Promise.all(workers);

	// Preserve deterministic order (match original scout list order).
	const ordered: ScoutRunResult[] = [];
	for (const s of scouts) {
		const found = results.find((r) => r.name === s.name);
		if (found) ordered.push(found);
	}
	return ordered;
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

/**
 * Fleet-wide status — one line per scout with the latest run's
 * task ID, status, duration, and repos-discovered count.
 */
export async function scoutStatusCommand(): Promise<void> {
	const scouts = await discoverScouts();
	if (scouts.length === 0) {
		log.message(`No scouts found in ${SCOUTS_DIR}/.`);
		return;
	}

	log.info(pc.bold("Scout fleet status"));
	console.log();

	for (const scout of scouts) {
		const runs = await listRuns(scout.name);
		if (runs.length === 0) {
			log.message(
				`  ${pc.bold(pc.cyan(scout.name.padEnd(18)))}  ${pc.dim("no runs yet")}`,
			);
			continue;
		}

		const latest = runs[0];
		if (!latest) continue;

		const statusColor =
			latest.status === "complete"
				? pc.green
				: latest.status === "failed"
					? pc.red
					: pc.yellow;

		const duration =
			latest.completedAt && latest.startedAt
				? Math.round(
						(new Date(latest.completedAt).getTime() -
							new Date(latest.startedAt).getTime()) /
							1000,
					)
				: null;

		const durationStr = duration !== null ? `${duration}s` : "—";
		const iterations = `${latest.currentIteration}/${latest.maxIterations}`;

		log.message(
			`  ${pc.bold(pc.cyan(scout.name.padEnd(18)))}  ${statusColor(
				latest.status.padEnd(8),
			)}  ${pc.dim(latest.taskId)}  ${pc.dim(`iter ${iterations}`)}  ${pc.dim(durationStr)}  ${pc.dim(`${latest.reposDiscovered} repos`)}`,
		);
	}
}

/**
 * Follow a scout's in-flight run, printing each new hook sidecar
 * (`NN-spawn.json` and `NN-turn.json` from `.kiro/hooks/*.sh`) as it
 * lands in the latest run's `iterations/` directory. Polls every 2s.
 */
export async function scoutTailCommand(
	name: string,
	opts: { interval?: string } = {},
): Promise<void> {
	const intervalMs = Math.max(
		250,
		Number.parseInt(opts.interval ?? "2000", 10) || 2000,
	);

	const scouts = await discoverScouts();
	const scout = scouts.find((s) => s.name === name);
	if (!scout) {
		log.error(
			pc.red(
				`Scout "${name}" not found. Available: ${scouts.map((s) => s.name).join(", ")}`,
			),
		);
		return;
	}

	const runs = await listRuns(name);
	const latest = runs[0];
	if (!latest) {
		log.message(`No runs yet for scout "${name}".`);
		return;
	}

	const iterationsDir = join(RESULTS_DIR, name, latest.taskId, "iterations");
	log.info(pc.bold(`Tailing ${pc.cyan(name)} — run ${latest.taskId}`));
	log.message(pc.dim(`   ${iterationsDir} (polling every ${intervalMs}ms)`));
	console.log();

	const seen = new Set<string>();

	// Initial snapshot — print already-present sidecars, then stream.
	const initial = await safeReaddir(iterationsDir);
	for (const f of initial.sort()) {
		if (f.endsWith(".json")) {
			seen.add(f);
			log.message(pc.dim(`  [catch-up] ${f}`));
		}
	}

	// Poll until the run finishes. Non-blocking on Ctrl+C — SIGINT kicks us
	// out cleanly.
	let shouldStop = false;
	process.on("SIGINT", () => {
		shouldStop = true;
	});

	while (!shouldStop) {
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
		const entries = await safeReaddir(iterationsDir);
		for (const f of entries.sort()) {
			if (!f.endsWith(".json") || seen.has(f)) continue;
			seen.add(f);
			log.message(
				`  ${pc.green("▸")} ${pc.bold(f)}  ${pc.dim(new Date().toISOString())}`,
			);
		}

		// Stop tailing once the run has left `running` state.
		const refreshed = await listRuns(name);
		const current = refreshed[0];
		if (
			current &&
			current.taskId === latest.taskId &&
			current.status !== "running"
		) {
			log.message(pc.dim(`\n  Run ${current.status} — stopped tailing.`));
			break;
		}
	}
}

async function safeReaddir(dir: string): Promise<string[]> {
	try {
		return await readdir(dir);
	} catch {
		return [];
	}
}
