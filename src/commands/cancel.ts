/**
 * @fileoverview Cancel command for Ralph Wiggum CLI.
 * Stops an active loop by removing state files.
 * @module commands/cancel
 */
import { unlink } from "node:fs/promises";
import { log } from "@clack/prompts";

import { stateFromMarkdown } from "../schemas/state";
import { SESSION_FILE, STATE_FILE } from "../utils/paths";

/**
 * Cancels an active Ralph Wiggum loop.
 * Removes the state file and session file from the .ralph directory.
 * @returns Resolves when cancellation is complete
 */
export async function cancelCommand(): Promise<void> {
	const stateFile = Bun.file(STATE_FILE);

	if (!(await stateFile.exists())) {
		log.message("No active Ralph loop found.");
		return;
	}

	// Try to get iteration number for display
	let iteration: number | string = "?";
	try {
		const content = await stateFile.text();
		const state = stateFromMarkdown(content);
		iteration = state.iteration;
	} catch {
		// Ignore parse errors, just show "?"
	}

	// Delete state files
	await Promise.all([
		unlink(STATE_FILE).catch(() => {}),
		unlink(SESSION_FILE).catch(() => {}),
	]);

	log.message(`Cancelled Ralph loop (was at iteration ${iteration})`);
}
