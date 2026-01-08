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
});

/**
 * Configuration options for running an iterative loop.
 * Inferred from LoopConfigSchema.
 */
export type LoopConfig = z.infer<typeof LoopConfigSchema>;
