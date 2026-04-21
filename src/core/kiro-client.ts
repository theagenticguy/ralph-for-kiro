/**
 * @fileoverview Kiro CLI subprocess wrapper.
 * Provides a client interface for spawning kiro-cli chat sessions.
 * @module core/kiro-client
 */
import { AGENT_CONFIG_PATH, DEFAULT_AGENT_NAME } from "../utils/paths";

/**
 * Per-invocation hook environment passed to kiro-cli. These env vars let the
 * scripts in `.kiro/hooks/` emit structured per-turn artifacts (spawn marker,
 * stop marker) into a known run directory without having to parse the hook's
 * JSON stdin payload, which varies across Kiro versions.
 */
export interface HookEnv {
	/** Absolute path to the run's results dir (e.g. `results/<scout>/pw-*`). */
	runDir?: string;
	/** 1-based iteration number the runner is about to execute. */
	iteration?: number;
	/** Scout name, if this is a scout-scoped run. Empty string otherwise. */
	scoutName?: string;
}

/**
 * Client for interacting with kiro-cli subprocess.
 * Wraps the kiro-cli chat command with the Ralph Wiggum agent.
 */
export class KiroClient {
	/** The agent name to use for kiro-cli */
	private agentName: string;

	/**
	 * Creates a new KiroClient instance.
	 * @param agentName - Optional agent name override. If not provided, uses the default Ralph Wiggum agent.
	 * @throws {Error} If the agent config file doesn't exist when using the default agent
	 */
	constructor(agentName?: string | null) {
		this.agentName = agentName ?? this.getDefaultAgentName();
	}

	/**
	 * Gets the default agent name, verifying the config file exists.
	 * @returns The default agent name
	 * @throws {Error} If the agent config file doesn't exist
	 */
	private getDefaultAgentName(): string {
		const configFile = Bun.file(AGENT_CONFIG_PATH);
		if (!configFile.size) {
			throw new Error(
				`Agent config not found at ${AGENT_CONFIG_PATH}\nRun 'ralph init' first to initialize Ralph Wiggum in this project.`,
			);
		}
		return DEFAULT_AGENT_NAME;
	}

	/**
	 * Run a kiro-cli chat session.
	 * @param prompt - The prompt to send to kiro-cli
	 * @param hookEnv - Optional hook environment (runDir, iteration, scoutName).
	 * @returns Exit code from kiro-cli
	 */
	async runChat(prompt: string, hookEnv?: HookEnv): Promise<number> {
		const env = buildHookEnv(hookEnv);

		// Pass prompt as positional argument [INPUT], not via stdin
		const proc = Bun.spawn(
			[
				"kiro-cli",
				"chat",
				"--agent",
				this.agentName,
				"--no-interactive",
				"--trust-all-tools",
				prompt, // Positional argument for the input question
			],
			{
				stdout: "inherit", // Show output in real-time
				stderr: "inherit",
				env,
			},
		);

		await proc.exited;
		return proc.exitCode ?? 1;
	}
}

/**
 * Build the child-process env by layering RALPH_* hook vars onto the parent
 * process env. Exported for testing.
 */
export function buildHookEnv(hookEnv?: HookEnv): NodeJS.ProcessEnv {
	const env: NodeJS.ProcessEnv = { ...process.env };
	if (!hookEnv) return env;

	if (hookEnv.runDir !== undefined) {
		env["RALPH_RUN_DIR"] = hookEnv.runDir;
	}
	if (hookEnv.iteration !== undefined) {
		env["RALPH_ITERATION"] = String(hookEnv.iteration);
	}
	if (hookEnv.scoutName !== undefined) {
		env["RALPH_SCOUT_NAME"] = hookEnv.scoutName;
	}
	return env;
}
