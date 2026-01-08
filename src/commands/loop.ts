/**
 * @fileoverview Loop command for Ralph Wiggum CLI.
 * Starts an iterative loop that runs kiro-cli until completion.
 * @module commands/loop
 */
import { log } from "@clack/prompts";
import pc from "picocolors";

import { runLoop } from "../core/loop-runner";
import { LoopConfigSchema } from "../schemas/config";

/**
 * CLI options for the loop command (raw string values from commander).
 */
interface LoopOptions {
	/** Minimum iterations before checking completion (string from CLI) */
	minIterations: string;
	/** Maximum iterations, 0 for unlimited (string from CLI) */
	maxIterations: string;
	/** Phrase that signals loop completion */
	completionPromise: string;
	/** Optional agent name override */
	agent?: string;
}

/**
 * Starts a Ralph Wiggum iterative loop.
 * Parses and validates CLI options with Zod, then delegates to runLoop().
 * @param prompt - The task prompt for the loop
 * @param opts - Command options from CLI
 * @returns Resolves when the loop completes or is interrupted
 * @throws Exits process with code 1 if validation fails
 */
export async function loopCommand(
	prompt: string,
	opts: LoopOptions,
): Promise<void> {
	// Parse and validate options with Zod
	const result = LoopConfigSchema.safeParse({
		prompt,
		minIterations: Number.parseInt(opts.minIterations, 10),
		maxIterations: Number.parseInt(opts.maxIterations, 10),
		completionPromise: opts.completionPromise,
		agentName: opts.agent ?? null,
	});

	if (!result.success) {
		// Format Zod error messages
		const errorMessages = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		log.error(pc.red(`Validation error:\n${errorMessages}`));
		process.exit(1);
	}

	await runLoop(result.data);
}
