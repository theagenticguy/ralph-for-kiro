/**
 * @fileoverview Per-scout isolation bootstrap.
 *
 * Each scout owns its own `.kiro/` tree under `scouts/<name>/.kiro/` so
 * scouts on divergent topics (ai-security, ai-eval, agent-sdks, ...) never
 * share session history, steering, or agent config with their neighbors.
 * Kiro discovers `.kiro/` relative to the subprocess cwd, so isolation is
 * enforced at the OS process boundary — `runChat` is spawned with
 * `cwd = scouts/<name>/` and reads that scout's `.kiro/` only.
 *
 * @module core/scout-init
 */
import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import probeTopicConfig from "../data/probe-topic.json";
import probeTopicSteering from "../data/probe-topic.md" with { type: "text" };
import agentConfig from "../data/project-watcher.json";
import steeringContent from "../data/watcher-context.md" with { type: "text" };
import { installHookScripts } from "./hook-installer";

/**
 * Derive the scout name from its directory so the knowledge-base index
 * scopes to `results/<name>/**` and only sees this scout's own history.
 */
function scoutNameOf(scoutDir: string): string {
	return basename(scoutDir);
}

/** Subfolders under a scout's `.kiro/`, stamped on first run. */
const SCOUT_KIRO_SUBDIRS = ["agents", "steering", "hooks", "settings"] as const;

/**
 * Ensure the per-scout `.kiro/` tree exists with a project-watcher agent,
 * steering doc, and hook scripts. Idempotent. Called at the top of every
 * scout run so new scouts produced by `ralph scout init` get bootstrapped
 * on first use without an explicit migration step.
 *
 * @param scoutDir - Absolute path to `scouts/<name>/`.
 * @returns Absolute path to the scout's `.kiro/` directory.
 */
export async function ensureScoutKiroTree(scoutDir: string): Promise<string> {
	const kiroDir = join(scoutDir, ".kiro");

	for (const sub of SCOUT_KIRO_SUBDIRS) {
		await mkdir(join(kiroDir, sub), { recursive: true });
	}

	// Agent configs — idempotent writes so bumps to the defaults propagate.
	// project-watcher is the scout's main agent; probe-topic is the
	// intra-scout subagent it fans out to via use_subagent.
	//
	// The default agentConfig ships with resources paths relative to the
	// REPO-ROOT cwd (e.g. `../../watch-manifest.json`). When run from a
	// scout cwd (`scouts/<name>/`), those paths are wrong — the manifest is
	// right there as `manifest.json` and the loop state is
	// `.kiro/ralph-loop.local.json`. We also attach a knowledge-base
	// resource over past scout summaries so each scout sees only its own
	// history — no cross-scout leakage. See src/data/probe-topic.md for
	// the probe-topic contract.
	const scoutAgent = {
		...agentConfig,
		resources: [
			"file://manifest.json",
			"file://.kiro/ralph-loop.local.json",
			{
				type: "knowledgeBase",
				source: "file://../../results",
				name: "scout-history",
				description:
					"Past summary.md files produced by this scout. Use to avoid re-discovering repos and to reference prior iteration findings.",
				indexType: "best",
				include: [`${scoutNameOf(scoutDir)}/**/summary.md`],
				autoUpdate: true,
			},
		],
	};
	const agentPath = join(kiroDir, "agents", "project-watcher.json");
	await Bun.write(agentPath, `${JSON.stringify(scoutAgent, null, 2)}\n`);

	const probeAgentPath = join(kiroDir, "agents", "probe-topic.json");
	await Bun.write(
		probeAgentPath,
		`${JSON.stringify(probeTopicConfig, null, 2)}\n`,
	);

	// Steering — scout-local copies so each scout can diverge later without
	// touching the repo-root files. Preserved once a user has customized.
	const steeringPath = join(kiroDir, "steering", "watcher-context.md");
	if (!(await Bun.file(steeringPath).exists())) {
		await Bun.write(steeringPath, steeringContent);
	}
	const probeSteeringPath = join(kiroDir, "steering", "probe-topic.md");
	if (!(await Bun.file(probeSteeringPath).exists())) {
		await Bun.write(probeSteeringPath, probeTopicSteering);
	}

	// Hooks — same scripts as repo-root, just re-stamped under the scout's
	// tree so Kiro finds them via cwd resolution.
	await installHookScripts(join(kiroDir, "hooks"));

	return kiroDir;
}
