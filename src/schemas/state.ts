/**
 * @fileoverview LoopState schema and JSON serialization.
 * Manages the state file that tracks loop progress.
 * @module schemas/state
 */
import { z } from "zod";

/**
 * Zod schema for previous feedback validation.
 */
export const PreviousFeedbackSchema = z
	.object({
		qualityScore: z.number().int().min(1).max(10).optional(),
		qualitySummary: z.string().optional(),
		improvements: z.array(z.string()).optional(),
		nextSteps: z.array(z.string()).optional(),
		ideas: z.array(z.string()).optional(),
		blockers: z.array(z.string()).optional(),
	})
	.optional();

/**
 * Zod schema for loop state validation.
 * Represents the current state of an active loop.
 */
export const LoopStateSchema = z.object({
	/** Whether the loop is currently active */
	active: z.boolean().default(true),
	/** Current iteration number (1-based) */
	iteration: z.number().int().min(1).default(1),
	/** Minimum iterations before checking for completion */
	minIterations: z.number().int().min(1).default(1),
	/** Maximum iterations (0 = unlimited) */
	maxIterations: z.number().int().min(0).default(0),
	/** Phrase that signals loop completion */
	completionPromise: z.string().default("COMPLETE"),
	/** ISO timestamp when the loop started */
	startedAt: z.string().default(() => new Date().toISOString()),
	/** The task prompt for the loop */
	prompt: z.string(),
	/** Feedback from the previous iteration */
	previousFeedback: PreviousFeedbackSchema,
});

/**
 * Current state of an active loop.
 * Inferred from LoopStateSchema.
 */
export type LoopState = z.infer<typeof LoopStateSchema>;

/**
 * Serializes LoopState to a JSON string.
 * Uses camelCase throughout - no conversion needed.
 * @param state - The loop state to serialize
 * @returns JSON string representation of the state
 * @example
 * ```typescript
 * const json = stateToJson({
 *   active: true,
 *   iteration: 1,
 *   minIterations: 1,
 *   maxIterations: 10,
 *   completionPromise: "DONE",
 *   startedAt: "2024-01-01T00:00:00.000Z",
 *   prompt: "Build a CLI tool"
 * });
 * ```
 */
export function stateToJson(state: LoopState): string {
	return JSON.stringify(state);
}

/**
 * Parses LoopState from a JSON string.
 * @param content - JSON string representation of the state
 * @returns The parsed LoopState object
 * @throws {SyntaxError} If the JSON is malformed
 * @throws {ZodError} If the parsed data doesn't match the schema
 */
export function stateFromJson(content: string): LoopState {
	const parsed = JSON.parse(content);
	return LoopStateSchema.parse(parsed);
}
