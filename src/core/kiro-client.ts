/**
 * @fileoverview Kiro CLI subprocess wrapper.
 * Provides a client interface for spawning kiro-cli chat sessions.
 * @module core/kiro-client
 */
import { AGENT_CONFIG_PATH, DEFAULT_AGENT_NAME } from "../utils/paths";

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
	 * @returns Exit code from kiro-cli
	 */
	async runChat(prompt: string): Promise<number> {
		const proc = Bun.spawn(
			[
				"kiro-cli",
				"chat",
				"--agent",
				this.agentName,
				"--no-interactive",
				"--trust-all-tools",
			],
			{
				stdin: new Response(prompt),
				stdout: "inherit", // Show output in real-time
				stderr: "inherit",
			},
		);

		await proc.exited;
		return proc.exitCode ?? 1;
	}
}
