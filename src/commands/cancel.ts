/**
 * @fileoverview Cancel command for Ralph Wiggum CLI.
 * Stops an active loop by removing state files.
 * @module commands/cancel
 */
import { unlink } from "node:fs/promises";
import { log } from "@clack/prompts";

import { type LoopState, stateFromJson } from "../schemas/state";
import { SESSION_FILE, STATE_FILE } from "../utils/paths";

/**
 * Cancels an active Ralph Wiggum loop.
 * Marks the state as inactive so it can be resumed later.
 * @returns Resolves when cancellation is complete
 */
export async function cancelCommand(): Promise<void> {
	const stateFile = Bun.file(STATE_FILE);

	if (!(await stateFile.exists())) {
		log.message("No active Ralph loop found.");
		return;
	}

	// Read and parse the existing state
	let state: LoopState;
	let iteration: number | string = "?";
	try {
		const content = await stateFile.text();
		state = stateFromJson(content);
		iteration = state.iteration;
	} catch {
		// If we can't parse the state, just delete it
		await unlink(STATE_FILE).catch(() => {});
		log.message("Cancelled Ralph loop (invalid state file)");
		return;
	}

	// Mark state as inactive (preserves for resume)
	state.active = false;

	// Write updated state back
	await Bun.write(STATE_FILE, JSON.stringify(state));

	// Delete session file (not needed for resume)
	await unlink(SESSION_FILE).catch(() => {});

	log.message(`Cancelled Ralph loop at iteration ${iteration}`);
	log.message("Run 'ralph resume' to continue where you left off.");
}
