import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureScoutKiroTree } from "../src/core/scout-init.ts";
import { KIRO_SETTINGS_DIR } from "../src/utils/paths.ts";

describe("ensureScoutKiroTree", () => {
	test("stamps a complete .kiro/ tree under a scout directory", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-scout-"));
		try {
			const scoutDir = join(tempDir, "my-scout");
			const kiroDir = await ensureScoutKiroTree(scoutDir);

			// Tree shape — single stat() per subdir (throws if missing)
			// avoids the access()-then-open TOCTOU CodeQL flags.
			for (const sub of ["agents", "steering", "hooks", "settings"]) {
				const st = await stat(join(kiroDir, sub));
				expect(st.isDirectory()).toBe(true);
			}

			// Agent config present and parseable (Bun.file reads without
			// the stat+readFile TOCTOU pattern CodeQL flags).
			const agent = await Bun.file(
				join(kiroDir, "agents", "project-watcher.json"),
			).json();
			expect(agent.name).toBe("project-watcher");
			expect(agent.hooks).toBeDefined();
			// Resources rewritten for scout cwd; includes the scoped
			// knowledge-base index over this scout's own history.
			expect(agent.resources).toContain("file://manifest.json");
			const kb = agent.resources.find(
				(r: unknown): r is { type: string; include: string[] } =>
					typeof r === "object" && r !== null && "type" in r,
			);
			expect(kb).toBeDefined();
			expect(kb.type).toBe("knowledgeBase");
			// Scoped to THIS scout only — ai-security scout must not see
			// ai-eval history and vice versa.
			expect(kb.include).toEqual(["my-scout/**/summary.md"]);

			// probe-topic subagent present and parseable
			const probeAgent = await Bun.file(
				join(kiroDir, "agents", "probe-topic.json"),
			).json();
			expect(probeAgent.name).toBe("probe-topic");

			// Steering files present
			const steering = await Bun.file(
				join(kiroDir, "steering", "watcher-context.md"),
			).text();
			expect(steering.length).toBeGreaterThan(0);
			const probeSteering = await Bun.file(
				join(kiroDir, "steering", "probe-topic.md"),
			).text();
			expect(probeSteering.length).toBeGreaterThan(0);

			// Hook scripts present and executable — single stat()
			for (const name of ["on-agent-spawn.sh", "on-stop.sh"]) {
				const p = join(kiroDir, "hooks", name);
				const st = await stat(p);
				expect(st.mode & 0o100).toBe(0o100);
			}
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("is idempotent — steering is preserved across repeat calls", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-scout-"));
		try {
			const scoutDir = join(tempDir, "my-scout");
			const kiroDir = await ensureScoutKiroTree(scoutDir);

			// Simulate user edit of the steering doc
			const steeringPath = join(kiroDir, "steering", "watcher-context.md");
			await Bun.write(steeringPath, "CUSTOMIZED\n");

			// Re-run — should NOT overwrite steering
			await ensureScoutKiroTree(scoutDir);
			const after = await Bun.file(steeringPath).text();
			expect(after).toBe("CUSTOMIZED\n");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("does NOT emit unsupported availableAgents/trustedAgents fields", async () => {
		// Kiro CLI 2.0.1's agent-config schema does not include these fields.
		// Emitting them makes kiro-cli reject the whole config at agent-load.
		// Guard against a future reintroduction.
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-scout-"));
		try {
			const scoutDir = join(tempDir, "my-scout");
			const kiroDir = await ensureScoutKiroTree(scoutDir);
			const agent = await Bun.file(
				join(kiroDir, "agents", "project-watcher.json"),
			).json();
			expect(agent.availableAgents).toBeUndefined();
			expect(agent.trustedAgents).toBeUndefined();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test("copies the repo-root mcp.json into the scout's settings/", async () => {
		// Scouts spawn kiro-cli with cwd=scouts/<name>/, and Kiro reads
		// `.kiro/settings/mcp.json` relative to cwd. Without the copy the
		// scout loses @brave-search / @tavily / @exa. We write a temp
		// repo-root mcp.json, run ensureScoutKiroTree with cwd pointed at
		// that temp root, and assert the content lands in the scout tree.
		const tempRepo = await mkdtemp(join(tmpdir(), "ralph-repo-"));
		const originalCwd = process.cwd();
		try {
			const repoSettings = join(tempRepo, KIRO_SETTINGS_DIR);
			// Bun.write creates parent dirs as needed.
			const sentinelMcp = '{ "mcpServers": { "x": { "command": "y" } } }';
			await Bun.write(join(repoSettings, "mcp.json"), sentinelMcp);

			process.chdir(tempRepo);
			const scoutDir = join(tempRepo, "scouts", "mcp-test");
			const kiroDir = await ensureScoutKiroTree(scoutDir);

			const copied = await Bun.file(
				join(kiroDir, "settings", "mcp.json"),
			).text();
			expect(copied).toBe(sentinelMcp);
		} finally {
			process.chdir(originalCwd);
			await rm(tempRepo, { recursive: true, force: true });
		}
	});

	test("gracefully skips MCP copy when repo has no mcp.json", async () => {
		const tempRepo = await mkdtemp(join(tmpdir(), "ralph-repo-"));
		const originalCwd = process.cwd();
		try {
			process.chdir(tempRepo);
			const scoutDir = join(tempRepo, "scouts", "no-mcp");
			const kiroDir = await ensureScoutKiroTree(scoutDir);
			// No throw; settings/ dir still exists but without mcp.json
			const mcpFile = Bun.file(join(kiroDir, "settings", "mcp.json"));
			expect(await mcpFile.exists()).toBe(false);
		} finally {
			process.chdir(originalCwd);
			await rm(tempRepo, { recursive: true, force: true });
		}
	});
});
