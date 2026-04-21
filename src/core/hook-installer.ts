/**
 * @fileoverview Shared utility for installing the Kiro lifecycle hook scripts
 * that write per-turn sidecar artifacts under a run's `iterations/` dir.
 *
 * Both `ralph init` and `ralph watch init` call this so every surface that
 * scaffolds a Kiro agent also drops the hooks next to it.
 *
 * @module core/hook-installer
 */
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import onAgentSpawnScript from "../data/hooks/on-agent-spawn.sh" with {
	type: "text",
};
import onStopScript from "../data/hooks/on-stop.sh" with { type: "text" };
import { KIRO_HOOKS_DIR } from "../utils/paths";

/** Hook file names, mirrored by agent JSON's `hooks` field. */
export const HOOK_FILES = {
	onAgentSpawn: "on-agent-spawn.sh",
	onStop: "on-stop.sh",
} as const;

/**
 * Write the agentSpawn + stop hook scripts under `.kiro/hooks/`, chmod'd
 * executable. Idempotent: overwrites existing files so bumps to the script
 * body propagate on `ralph init --force` or subsequent `watch init`.
 *
 * @returns Absolute paths to the written scripts.
 */
export async function installHookScripts(
	hooksDir: string = KIRO_HOOKS_DIR,
): Promise<string[]> {
	await mkdir(hooksDir, { recursive: true });

	const written: string[] = [];
	const scripts: Array<[string, string]> = [
		[HOOK_FILES.onAgentSpawn, onAgentSpawnScript],
		[HOOK_FILES.onStop, onStopScript],
	];

	for (const [name, body] of scripts) {
		const path = join(hooksDir, name);
		await Bun.write(path, body);
		await chmod(path, 0o755);
		written.push(path);
	}

	return written;
}
