/**
 * @fileoverview Resume command for Ralph Wiggum CLI.
 * Resumes a stopped loop with context about previous work.
 * @module commands/resume
 */
import { log } from "@clack/prompts";
import pc from "picocolors";

import { runLoop } from "../core/loop-runner";
import { LoopConfigSchema } from "../schemas/config";
import { stateFromJson } from "../schemas/state";
import { STATE_FILE } from "../utils/paths";

/**
 * CLI options for the resume command (raw string values from commander).
 */
interface ResumeOptions {
	/** Minimum iterations before checking completion (string from CLI) */
	minIterations?: string;
	/** Maximum iterations, 0 for unlimited (string from CLI) */
	maxIterations?: string;
	/** Phrase that signals loop completion */
	completionPromise?: string;
	/** Optional agent name override */
	agent?: string;
}

/**
 * Resumes a stopped Ralph Wiggum loop.
 * Reads the existing state file, extracts information about previous work,
 * and continues the loop with enhanced context.
 * @param opts - Command options from CLI
 * @returns Resolves when the loop completes or is interrupted
 * @throws Exits process with code 1 if validation fails or no state file found
 */
export async function resumeCommand(opts: ResumeOptions): Promise<void> {
	const stateFile = Bun.file(STATE_FILE);

	// Check if state file exists
	if (!(await stateFile.exists())) {
		log.error(
			pc.red(
				"No stopped Ralph loop found. Run 'ralph loop' to start a new loop.",
			),
		);
		process.exit(1);
	}

	// Read and parse the existing state
	let existingState;
	try {
		const content = await stateFile.text();
		existingState = stateFromJson(content);
	} catch (error) {
		log.error(pc.red(`Failed to parse state file: ${error}`));
		process.exit(1);
	}

	// Display information about the previous loop
	log.info(pc.bold(pc.blue("Resuming Ralph loop")));
	log.message(`   Previous iteration: ${existingState.iteration}`);
	log.message(`   Original prompt: ${pc.dim(existingState.prompt)}`);
	if (existingState.previousFeedback?.qualityScore) {
		log.message(
			`   Last quality score: ${existingState.previousFeedback.qualityScore}/10`,
		);
	}
	console.log();

	// Build enhanced prompt with resume context
	const resumeContext = buildResumeContext(existingState);
	const enhancedPrompt = `${resumeContext}\n\nOriginal task: ${existingState.prompt}`;

	// Parse and validate options with Zod
	// Use existing state values as defaults if not provided
	const result = LoopConfigSchema.safeParse({
		prompt: enhancedPrompt,
		minIterations: opts.minIterations
			? Number.parseInt(opts.minIterations, 10)
			: existingState.minIterations,
		maxIterations: opts.maxIterations
			? Number.parseInt(opts.maxIterations, 10)
			: existingState.maxIterations,
		completionPromise:
			opts.completionPromise ?? existingState.completionPromise,
		agentName: opts.agent ?? null,
		isResume: true,
		resumeFromIteration: existingState.iteration,
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

/**
 * Builds context text about the previous loop for the resume prompt.
 * @param state - The existing loop state
 * @returns Formatted context string
 */
function buildResumeContext(state: ReturnType<typeof stateFromJson>): string {
	const lines = [
		"RESUME CONTEXT:",
		"===============",
		`You are resuming a Ralph loop that was stopped at iteration ${state.iteration}.`,
		"",
		"Before continuing, please:",
		"1. Review what was accomplished in previous iterations by checking:",
		"   - Files that were created or modified",
		"   - Git history (git log, git diff)",
		"   - Test results",
		"   - Build artifacts",
		"",
		"2. Review the previous feedback to understand where you left off:",
	];

	if (state.previousFeedback) {
		if (state.previousFeedback.qualitySummary) {
			lines.push(`   Quality: ${state.previousFeedback.qualitySummary}`);
		}

		if (
			state.previousFeedback.nextSteps &&
			state.previousFeedback.nextSteps.length > 0
		) {
			lines.push("   Planned next steps:");
			for (const step of state.previousFeedback.nextSteps) {
				lines.push(`   - ${step}`);
			}
		}

		if (
			state.previousFeedback.improvements &&
			state.previousFeedback.improvements.length > 0
		) {
			lines.push("   Areas for improvement:");
			for (const improvement of state.previousFeedback.improvements) {
				lines.push(`   - ${improvement}`);
			}
		}

		if (
			state.previousFeedback.blockers &&
			state.previousFeedback.blockers.length > 0
		) {
			lines.push("   Blockers:");
			for (const blocker of state.previousFeedback.blockers) {
				lines.push(`   - ${blocker}`);
			}
		}

		if (
			state.previousFeedback.ideas &&
			state.previousFeedback.ideas.length > 0
		) {
			lines.push("   Ideas to consider:");
			for (const idea of state.previousFeedback.ideas) {
				lines.push(`   - ${idea}`);
			}
		}
	} else {
		lines.push("   (No previous feedback available)");
	}

	lines.push("");
	lines.push(
		"3. Continue working toward completion of the original task below.",
	);
	lines.push("");

	return lines.join("\n");
}
