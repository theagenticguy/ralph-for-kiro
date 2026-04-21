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
import { join } from "node:path";
import probeTopicConfig from "../data/probe-topic.json";
import probeTopicSteering from "../data/probe-topic.md" with { type: "text" };
import agentConfig from "../data/project-watcher.json";
import steeringContent from "../data/watcher-context.md" with { type: "text" };
import { installHookScripts } from "./hook-installer";

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
	const agentPath = join(kiroDir, "agents", "project-watcher.json");
	await Bun.write(agentPath, `${JSON.stringify(agentConfig, null, 2)}\n`);

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
