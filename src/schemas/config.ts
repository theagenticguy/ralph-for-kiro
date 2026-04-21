/**
 * @fileoverview LoopConfig Zod schema for validating loop configuration.
 * Defines the configuration options for running an iterative loop.
 * @module schemas/config
 */
import { z } from "zod";

/**
 * Zod schema for loop configuration validation.
 * Validates and provides defaults for loop settings.
 */
export const LoopConfigSchema = z.object({
	/** The task prompt to send to kiro-cli */
	prompt: z.string().min(1, "Prompt cannot be empty"),
	/** Minimum iterations before checking for completion. Default: 1 */
	minIterations: z.number().int().min(1).default(1),
	/** Maximum iterations (0 = unlimited). Default: 0 */
	maxIterations: z.number().int().min(0).default(0),
	/** Phrase that signals loop completion. Default: "COMPLETE" */
	completionPromise: z
		.string()
		.refine((v) => v.trim().length > 0, "Completion promise cannot be empty")
		.default("COMPLETE"),
	/** Optional agent name override. Default: null (uses default agent) */
	agentName: z.string().nullable().default(null),
	/** Whether this is a resume operation. Default: false */
	isResume: z.boolean().default(false),
	/** Iteration number to resume from. Default: 0 */
	resumeFromIteration: z.number().int().min(0).default(0),
	/**
	 * Absolute path to the per-run results directory. When set, the runner
	 * passes RALPH_RUN_DIR to kiro-cli so hook scripts can drop per-iteration
	 * sidecar artifacts under `iterations/`.
	 */
	runDir: z.string().nullable().default(null),
	/** Scout name for scout-scoped runs. Empty/null for non-scout watches. */
	scoutName: z.string().nullable().default(null),
	/**
	 * Optional absolute working directory for the spawned kiro-cli process.
	 * When set, the subprocess cwd is changed to this path. Used for scout
	 * isolation: pointing at `scouts/<name>/` makes Kiro pick up the per-scout
	 * `.kiro/` config tree (agents, steering, hooks, MCP config, session
	 * history) instead of the shared root one.
	 */
	scoutCwd: z.string().nullable().default(null),
});

/**
 * Configuration options for running an iterative loop.
 * Inferred from LoopConfigSchema.
 */
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
