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

			// Steering file present
			const steering = await readFile(
				join(kiroDir, "steering", "watcher-context.md"),
				"utf-8",
			);
			expect(steering.length).toBeGreaterThan(0);

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
