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
import { checkCompletionPromise } from "../schemas/session";
import { type LoopState, stateToMarkdown } from "../schemas/state";
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

	// Display startup info
	log.info(pc.bold(pc.blue("Ralph loop starting")));
	log.message(`   Min iterations: ${config.minIterations}`);
	log.message(`   Max iterations: ${config.maxIterations || "unlimited"}`);
	log.message(`   Completion promise: ${config.completionPromise}`);
	console.log();

	let iteration = 0;

	// Cleanup function to remove state file
	const cleanup = async (): Promise<void> => {
		await unlink(STATE_FILE).catch(() => {});
	};

	// Handle Ctrl+C gracefully
	process.on("SIGINT", async () => {
		log.warn(pc.yellow(`\nInterrupted at iteration ${iteration}`));
		await cleanup();
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
			};

			// Ensure directory exists and write state file
			await mkdir(dirname(STATE_FILE), { recursive: true });
			await Bun.write(STATE_FILE, stateToMarkdown(state));

			// Log iteration start
			log.step(pc.yellow(`Iteration ${iteration}`));

			// Run kiro-cli
			const exitCode = await client.runChat(config.prompt);

			if (exitCode !== 0) {
				log.warn(pc.red(`Kiro exited with code ${exitCode}`));
			}

			// Only check for completion after minimum iterations reached
			if (iteration >= config.minIterations) {
				const session = getLatestSession(cwd);
				if (
					session &&
					checkCompletionPromise(session, config.completionPromise)
				) {
					log.success(pc.green(`Completed at iteration ${iteration}!`));
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
				await cleanup();
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
