/**
 * @fileoverview Init command for Ralph Wiggum CLI.
 * Creates the necessary configuration files in the .kiro directory.
 * @module commands/init
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "@clack/prompts";
import pc from "picocolors";

import { KIRO_AGENTS_DIR, KIRO_STEERING_DIR } from "../utils/paths";

import steeringContent from "../data/ralph-context.md" with { type: "text" };
// Import bundled data files
import agentConfig from "../data/ralph-wiggum.json";

/**
 * Options for the init command.
 */
interface InitOptions {
	/** Whether to overwrite existing files */
	force?: boolean;
}

/**
 * Initializes Ralph Wiggum in the current project.
 * Creates .kiro/agents/ralph-wiggum.json and .kiro/steering/ralph-context.md
 * @param opts - Command options
 * @param opts.force - If true, overwrites existing files
 * @returns Resolves when initialization is complete
 */
export async function initCommand(opts: InitOptions): Promise<void> {
	const agentPath = join(KIRO_AGENTS_DIR, "ralph-wiggum.json");
	const steeringPath = join(KIRO_STEERING_DIR, "ralph-context.md");

	// Check for existing files
	const agentExists = await Bun.file(agentPath).exists();
	const steeringExists = await Bun.file(steeringPath).exists();

	if (!opts.force && (agentExists || steeringExists)) {
		log.error(pc.red("Files already exist:"));
		if (agentExists) log.message(`  - ${agentPath}`);
		if (steeringExists) log.message(`  - ${steeringPath}`);
		log.message(`\nUse ${pc.bold("--force")} to overwrite.`);
		return;
	}

	// Create directories
	await mkdir(KIRO_AGENTS_DIR, { recursive: true });
	await mkdir(KIRO_STEERING_DIR, { recursive: true });

	// Write agent config
	await Bun.write(agentPath, `${JSON.stringify(agentConfig, null, 2)}\n`);
	log.success(`${pc.green("Created")} ${agentPath}`);

	// Write steering file (imported as text at compile time)
	await Bun.write(steeringPath, steeringContent);
	log.success(`${pc.green("Created")} ${steeringPath}`);

	// Success message
	console.log();
	log.success(pc.bold(pc.green("Ralph Wiggum initialized!")));
	console.log();
	log.message("You can now use the Ralph agent with kiro-cli:");
	log.message(pc.dim("  kiro-cli chat --agent .kiro/agents/ralph-wiggum.json"));
	console.log();
	log.message("Or start a Ralph loop:");
	log.message(
		pc.dim(
			'  ralph loop "Your task" --max-iterations 20 --completion-promise "DONE"',
		),
	);
}
