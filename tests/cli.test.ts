import { describe, expect, test } from "bun:test";
import { VERSION } from "../src/version";

describe("CLI", () => {
	test("--version shows correct version", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "--version"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output.trim()).toBe(VERSION);
	});

	test("--help shows all commands", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output).toContain("init");
		expect(output).toContain("loop");
		expect(output).toContain("cancel");
	});

	test("init --help shows force option", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "init", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output).toContain("--force");
		expect(output).toContain("-f");
	});

	test("loop --help shows all options", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "loop", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output).toContain("--min-iterations");
		expect(output).toContain("--max-iterations");
		expect(output).toContain("--completion-promise");
		expect(output).toContain("--agent");
	});

	test("--help shows resume command", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output).toContain("resume");
	});

	test("resume --help shows all options", async () => {
		const proc = Bun.spawn(["bun", "run", "src/index.ts", "resume", "--help"], {
			stdout: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		expect(output).toContain("--min-iterations");
		expect(output).toContain("--max-iterations");
		expect(output).toContain("--completion-promise");
		expect(output).toContain("--agent");
	});
});
