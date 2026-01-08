/**
 * @fileoverview LoopState schema and YAML frontmatter serialization.
 * Manages the state file that tracks loop progress.
 * @module schemas/state
 */
import YAML from "yaml";
import { z } from "zod";
import type { RalphFeedback } from "./session";

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
 * YAML frontmatter structure for previous feedback (snake_case).
 */
interface YamlPreviousFeedback {
	quality_score?: number;
	quality_summary?: string;
	improvements?: string[];
	next_steps?: string[];
	ideas?: string[];
	blockers?: string[];
}

/**
 * YAML frontmatter structure for state file.
 * Uses snake_case for YAML conventions.
 */
interface YamlFrontmatter {
	/** Whether the loop is currently active */
	active: boolean;
	/** Current iteration number */
	iteration: number;
	/** Minimum iterations before checking for completion */
	min_iterations: number;
	/** Maximum iterations (0 = unlimited) */
	max_iterations: number;
	/** Phrase that signals loop completion */
	completion_promise: string;
	/** ISO timestamp when the loop started */
	started_at: string;
	/** Feedback from previous iteration */
	previous_feedback?: YamlPreviousFeedback;
}

/**
 * Serializes LoopState to markdown with YAML frontmatter.
 * The prompt becomes the markdown body after the frontmatter.
 * @param state - The loop state to serialize
 * @returns Markdown string with YAML frontmatter
 * @example
 * ```typescript
 * const markdown = stateToMarkdown({
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
export function stateToMarkdown(state: LoopState): string {
	const { prompt, previousFeedback, ...frontmatter } = state;
	// Convert camelCase to snake_case for YAML conventions
	const yamlData: YamlFrontmatter = {
		active: frontmatter.active,
		iteration: frontmatter.iteration,
		min_iterations: frontmatter.minIterations,
		max_iterations: frontmatter.maxIterations,
		completion_promise: frontmatter.completionPromise,
		started_at: frontmatter.startedAt,
	};

	// Add previous feedback if present (convert camelCase to snake_case)
	if (previousFeedback) {
		yamlData.previous_feedback = {
			quality_score: previousFeedback.qualityScore,
			quality_summary: previousFeedback.qualitySummary,
			improvements: previousFeedback.improvements,
			next_steps: previousFeedback.nextSteps,
			ideas: previousFeedback.ideas,
			blockers: previousFeedback.blockers,
		};
	}

	const yamlStr = YAML.stringify(yamlData);
	return `---\n${yamlStr}---\n\n${prompt}`;
}

/**
 * Parses LoopState from markdown with YAML frontmatter.
 * @param content - Markdown string with YAML frontmatter
 * @returns The parsed LoopState object
 * @throws {Error} If the frontmatter is missing or malformed
 * @throws {ZodError} If the parsed data doesn't match the schema
 */
export function stateFromMarkdown(content: string): LoopState {
	const parts = content.split("---");
	if (parts.length < 3) {
		throw new Error("Invalid state file format: missing YAML frontmatter");
	}

	const yamlContent = parts[1];
	if (!yamlContent) {
		throw new Error("Invalid state file format: missing YAML content");
	}

	const fm = YAML.parse(yamlContent) as YamlFrontmatter | null;

	if (!fm) {
		throw new Error("Invalid state file format: empty frontmatter");
	}

	const prompt = parts.slice(2).join("---").trim();

	// Convert previous feedback from snake_case to camelCase
	let previousFeedback: RalphFeedback | undefined;
	if (fm.previous_feedback) {
		previousFeedback = {
			qualityScore: fm.previous_feedback.quality_score,
			qualitySummary: fm.previous_feedback.quality_summary,
			improvements: fm.previous_feedback.improvements,
			nextSteps: fm.previous_feedback.next_steps,
			ideas: fm.previous_feedback.ideas,
			blockers: fm.previous_feedback.blockers,
		};
	}

	// Convert snake_case back to camelCase
	return LoopStateSchema.parse({
		active: fm.active,
		iteration: fm.iteration,
		minIterations: fm.min_iterations,
		maxIterations: fm.max_iterations,
		completionPromise: fm.completion_promise,
		startedAt: fm.started_at,
		prompt,
		previousFeedback,
	});
}
