import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureScoutKiroTree } from "../src/core/scout-init.ts";

describe("ensureScoutKiroTree", () => {
	test("stamps a complete .kiro/ tree under a scout directory", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "ralph-scout-"));
		try {
			const scoutDir = join(tempDir, "my-scout");
			const kiroDir = await ensureScoutKiroTree(scoutDir);

			// Tree shape
			for (const sub of ["agents", "steering", "hooks", "settings"]) {
				await access(join(kiroDir, sub));
			}

			// Agent config present and parseable
			const agentJson = await readFile(
				join(kiroDir, "agents", "project-watcher.json"),
				"utf-8",
			);
			const agent = JSON.parse(agentJson);
			expect(agent.name).toBe("project-watcher");
			expect(agent.hooks).toBeDefined();
			// Subagent whitelist present so probe-topic can be spawned via
			// use_subagent but nothing else can.
			expect(agent.availableAgents).toEqual(["probe-*"]);
			expect(agent.trustedAgents).toEqual(["probe-topic"]);

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
			const probeAgentJson = await readFile(
				join(kiroDir, "agents", "probe-topic.json"),
				"utf-8",
			);
			const probeAgent = JSON.parse(probeAgentJson);
			expect(probeAgent.name).toBe("probe-topic");

			// Steering files present
			const steering = await readFile(
				join(kiroDir, "steering", "watcher-context.md"),
				"utf-8",
			);
			expect(steering.length).toBeGreaterThan(0);
			const probeSteering = await readFile(
				join(kiroDir, "steering", "probe-topic.md"),
				"utf-8",
			);
			expect(probeSteering.length).toBeGreaterThan(0);

			// Hook scripts present and executable
			for (const name of ["on-agent-spawn.sh", "on-stop.sh"]) {
				const p = join(kiroDir, "hooks", name);
				await access(p);
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
			const after = await readFile(steeringPath, "utf-8");
			expect(after).toBe("CUSTOMIZED\n");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
