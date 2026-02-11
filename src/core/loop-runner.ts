/**
 * @fileoverview Main loop orchestration for Ralph Wiggum.
 * Manages the iterative loop that runs kiro-cli until completion.
 * @module core/loop-runner
 */
import { mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { log } from "@clack/prompts";
import pc from "picocolors";

import type { LoopConfig } from "../schemas/config";
import {
	checkCompletionPromise,
	extractRalphFeedback,
	type RalphFeedback,
} from "../schemas/session";
import { type LoopState, stateToJson } from "../schemas/state";
import { STATE_FILE } from "../utils/paths";
import { KiroClient } from "./kiro-client";
import { getLatestSession } from "./session-reader";

/**
 * Runs the Ralph Wiggum iterative loop.
 * Executes kiro-cli repeatedly until the completion promise is detected
 * or maximum iterations are reached.
 * @param config - Loop configuration with prompt and iteration settings
 * @returns Resolves when the loop completes, is interrupted, or reaches max iterations
 * @example
 * ```typescript
 * await runLoop({
 *   prompt: "Build a REST API",
 *   minIterations: 1,
 *   maxIterations: 10,
 *   completionPromise: "DONE",
 *   agentName: null
 * });
 * ```
 */
export async function runLoop(config: LoopConfig): Promise<void> {
	const client = new KiroClient(config.agentName);
	const cwd = process.cwd();

	// Cleanup function to mark state as inactive (preserves for resume)
	const cleanup = async (
		currentIteration?: number,
		currentFeedback?: RalphFeedback,
	): Promise<void> => {
		// If we have iteration info, preserve the state for resume
		if (currentIteration !== undefined && currentIteration > 0) {
			try {
				const state: LoopState = {
					active: false, // Mark as inactive
					iteration: currentIteration,
					minIterations: config.minIterations,
					maxIterations: config.maxIterations,
					completionPromise: config.completionPromise,
					startedAt: new Date().toISOString(),
					prompt: config.prompt,
					previousFeedback: currentFeedback,
				};
				await mkdir(dirname(STATE_FILE), { recursive: true });
				await Bun.write(STATE_FILE, stateToJson(state));
			} catch {
				// If we can't write state, just delete it
				await unlink(STATE_FILE).catch(() => {});
			}
		} else {
			// No iteration info, just delete the state file
			await unlink(STATE_FILE).catch(() => {});
		}
	};

	// Clean any stale state file from a previous crashed loop
	// This prevents "already complete" issues when starting a new loop
	// Skip cleanup if this is a resume operation
	if (!config.isResume) {
		await cleanup();
	}

	// Display startup info
	const loopType = config.isResume
		? "Ralph loop resuming"
		: "Ralph loop starting";
	log.info(pc.bold(pc.blue(loopType)));
	log.message(`   Min iterations: ${config.minIterations}`);
	log.message(`   Max iterations: ${config.maxIterations || "unlimited"}`);
	log.message(`   Completion promise: ${config.completionPromise}`);
	if (config.isResume) {
		log.message(`   Resuming from iteration: ${config.resumeFromIteration}`);
	}
	console.log();

	let iteration = config.isResume ? config.resumeFromIteration : 0;
	let previousFeedback: RalphFeedback | undefined;

	// Handle Ctrl+C gracefully
	process.on("SIGINT", async () => {
		log.warn(pc.yellow(`\nInterrupted at iteration ${iteration}`));
		log.message("Saving state for resume...");
		await cleanup(iteration, previousFeedback);
		log.message("Run 'ralph resume' to continue where you left off.");
		process.exit(1);
	});

	try {
		while (true) {
			iteration++;

			// Create/update state file
			const state: LoopState = {
				active: true,
				iteration,
				minIterations: config.minIterations,
				maxIterations: config.maxIterations,
				completionPromise: config.completionPromise,
				startedAt: new Date().toISOString(),
				prompt: config.prompt,
				previousFeedback,
			};

			// Ensure directory exists and write state file
			await mkdir(dirname(STATE_FILE), { recursive: true });
			await Bun.write(STATE_FILE, stateToJson(state));

			// Log iteration start
			log.step(pc.yellow(`Iteration ${iteration}`));

			// Run kiro-cli
			const exitCode = await client.runChat(config.prompt);

			if (exitCode !== 0) {
				log.warn(pc.red(`Kiro exited with code ${exitCode}`));
			}

			// Small delay to ensure Kiro has fully released the database
			// and any WAL writes have synced
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Get the session to check completion and extract feedback
			// Wrap in try-catch to handle any database/memory issues gracefully
			let session = null;
			try {
				session = getLatestSession(cwd);
			} catch (err) {
				log.warn(pc.dim(`Could not read session: ${err}`));
			}

			// Extract feedback from this iteration for the next
			// Only if session looks valid (has history array)
			if (session?.history && Array.isArray(session.history)) {
				try {
					previousFeedback = extractRalphFeedback(session) ?? undefined;
					if (previousFeedback?.qualityScore !== undefined) {
						log.message(
							pc.dim(`Quality score: ${previousFeedback.qualityScore}/10`),
						);
					}
				} catch (err) {
					log.warn(pc.dim(`Could not extract feedback: ${err}`));
					previousFeedback = undefined;
				}
			}

			// Only check for completion after minimum iterations reached
			if (iteration >= config.minIterations) {
				if (
					session &&
					checkCompletionPromise(session, config.completionPromise)
				) {
					log.success(pc.green(`Completed at iteration ${iteration}!`));
					// Task completed successfully - can delete state
					await cleanup();
					process.exit(0);
				}
			} else {
				log.message(
					pc.dim(
						`Iteration ${iteration}/${config.minIterations} (min not reached, skipping completion check)`,
					),
				);
			}

			// Check max iterations
			if (config.maxIterations > 0 && iteration >= config.maxIterations) {
				log.warn(pc.red(`Max iterations (${config.maxIterations}) reached`));
				log.message("Saving state for resume...");
				await cleanup(iteration, previousFeedback);
				log.message("Run 'ralph resume' to continue where you left off.");
				process.exit(0);
			}
		}
	} catch (error) {
		// Re-throw non-interrupt errors
		if (error instanceof Error && !error.message.includes("SIGINT")) {
			throw error;
		}
	}
}
