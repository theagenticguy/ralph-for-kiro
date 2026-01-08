import { describe, expect, test } from "bun:test";
import { LoopConfigSchema } from "../src/schemas/config.ts";
import {
	KiroSessionSchema,
	checkCompletionPromise,
	getAssistantText,
	getLastAssistantText,
} from "../src/schemas/session.ts";
import {
	LoopStateSchema,
	stateFromMarkdown,
	stateToMarkdown,
} from "../src/schemas/state.ts";

describe("LoopConfigSchema", () => {
	test("validates a valid config", () => {
		const config = LoopConfigSchema.parse({
			prompt: "Do the thing",
			minIterations: 2,
			maxIterations: 10,
			completionPromise: "DONE",
			agentName: "my-agent",
		});

		expect(config.prompt).toBe("Do the thing");
		expect(config.minIterations).toBe(2);
		expect(config.maxIterations).toBe(10);
		expect(config.completionPromise).toBe("DONE");
		expect(config.agentName).toBe("my-agent");
	});

	test("applies defaults", () => {
		const config = LoopConfigSchema.parse({
			prompt: "Do the thing",
		});

		expect(config.minIterations).toBe(1);
		expect(config.maxIterations).toBe(0);
		expect(config.completionPromise).toBe("COMPLETE");
		expect(config.agentName).toBeNull();
	});

	test("rejects empty prompt", () => {
		expect(() => LoopConfigSchema.parse({ prompt: "" })).toThrow();
	});
});

describe("LoopStateSchema", () => {
	test("validates a valid state", () => {
		const state = LoopStateSchema.parse({
			active: true,
			iteration: 5,
			minIterations: 1,
			maxIterations: 20,
			completionPromise: "COMPLETE",
			startedAt: "2025-01-08T12:00:00.000Z",
			prompt: "Test prompt",
		});

		expect(state.active).toBe(true);
		expect(state.iteration).toBe(5);
		expect(state.prompt).toBe("Test prompt");
	});

	test("applies defaults", () => {
		const state = LoopStateSchema.parse({
			prompt: "Test prompt",
		});

		expect(state.active).toBe(true);
		expect(state.iteration).toBe(1);
		expect(state.minIterations).toBe(1);
		expect(state.maxIterations).toBe(0);
		expect(state.completionPromise).toBe("COMPLETE");
		expect(state.startedAt).toBeDefined();
	});
});

describe("stateToMarkdown / stateFromMarkdown", () => {
	test("round-trips state through markdown", () => {
		const original = LoopStateSchema.parse({
			active: true,
			iteration: 3,
			minIterations: 2,
			maxIterations: 10,
			completionPromise: "DONE",
			startedAt: "2025-01-08T12:00:00.000Z",
			prompt: "Complete the task",
		});

		const markdown = stateToMarkdown(original);
		const parsed = stateFromMarkdown(markdown);

		expect(parsed.active).toBe(original.active);
		expect(parsed.iteration).toBe(original.iteration);
		expect(parsed.minIterations).toBe(original.minIterations);
		expect(parsed.maxIterations).toBe(original.maxIterations);
		expect(parsed.completionPromise).toBe(original.completionPromise);
		expect(parsed.startedAt).toBe(original.startedAt);
		expect(parsed.prompt).toBe(original.prompt);
	});

	test("handles prompt with triple dashes", () => {
		const original = LoopStateSchema.parse({
			prompt: "Here is some code:\n---\ncode block\n---\nMore text",
		});

		const markdown = stateToMarkdown(original);
		const parsed = stateFromMarkdown(markdown);

		expect(parsed.prompt).toBe(original.prompt);
	});

	test("produces correct YAML frontmatter format", () => {
		const state = LoopStateSchema.parse({
			active: true,
			iteration: 1,
			minIterations: 1,
			maxIterations: 5,
			completionPromise: "COMPLETE",
			startedAt: "2025-01-08T12:00:00.000Z",
			prompt: "My prompt",
		});

		const markdown = stateToMarkdown(state);

		expect(markdown).toContain("---");
		expect(markdown).toContain("active: true");
		expect(markdown).toContain("iteration: 1");
		expect(markdown).toContain("min_iterations: 1");
		expect(markdown).toContain("max_iterations: 5");
		expect(markdown).toContain("completion_promise: COMPLETE");
		expect(markdown).toContain("started_at: 2025-01-08T12:00:00.000Z");
		expect(markdown).toContain("\n\nMy prompt");
	});

	test("throws on invalid format", () => {
		expect(() => stateFromMarkdown("no frontmatter")).toThrow();
		expect(() => stateFromMarkdown("---\n---")).toThrow();
	});
});

describe("KiroSessionSchema", () => {
	test("parses a session with history", () => {
		const session = KiroSessionSchema.parse({
			conversation_id: "test-123",
			history: [
				{ user: { message: "hello" } },
				{
					assistant: {
						Response: { message_id: "1", content: "Hi there!" },
					},
				},
			],
		});

		expect(session.conversation_id).toBe("test-123");
		expect(session.history).toHaveLength(2);
	});

	test("applies defaults for empty session", () => {
		const session = KiroSessionSchema.parse({});

		expect(session.conversation_id).toBe("");
		expect(session.history).toEqual([]);
	});

	test("allows extra fields via passthrough", () => {
		const input = {
			conversation_id: "test",
			history: [],
			extra_field: "some value",
		};
		const session = KiroSessionSchema.parse(input);

		// Verify the extra field is preserved through passthrough
		expect(JSON.stringify(session)).toContain('"extra_field":"some value"');
	});
});

describe("getAssistantText", () => {
	test("extracts text from Response", () => {
		const turn = {
			assistant: {
				Response: { message_id: "1", content: "Hello world!" },
			},
		};

		expect(getAssistantText(turn)).toBe("Hello world!");
	});

	test("returns null for missing assistant", () => {
		expect(getAssistantText({ user: { message: "hi" } })).toBeNull();
	});

	test("returns null for assistant without Response", () => {
		expect(getAssistantText({ assistant: { Other: "data" } })).toBeNull();
	});

	test("returns null for Response without content", () => {
		expect(
			getAssistantText({ assistant: { Response: { message_id: "1" } } }),
		).toBeNull();
	});
});

describe("getLastAssistantText", () => {
	test("returns last assistant response", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: { message_id: "1", content: "First response" },
					},
				},
				{ user: { message: "Follow up" } },
				{
					assistant: {
						Response: { message_id: "2", content: "Second response" },
					},
				},
			],
		});

		expect(getLastAssistantText(session)).toBe("Second response");
	});

	test("returns null for empty history", () => {
		const session = KiroSessionSchema.parse({ history: [] });
		expect(getLastAssistantText(session)).toBeNull();
	});
});

describe("checkCompletionPromise", () => {
	test("detects completion promise", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "Done! <promise>COMPLETE</promise>",
						},
					},
				},
			],
		});

		expect(checkCompletionPromise(session, "COMPLETE")).toBe(true);
		expect(checkCompletionPromise(session, "OTHER")).toBe(false);
	});

	test("case insensitive matching", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "<promise>complete</promise>",
						},
					},
				},
			],
		});

		expect(checkCompletionPromise(session, "COMPLETE")).toBe(true);
		expect(checkCompletionPromise(session, "Complete")).toBe(true);
	});

	test("handles whitespace in promise tag", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "<promise>  DONE  </promise>",
						},
					},
				},
			],
		});

		expect(checkCompletionPromise(session, "DONE")).toBe(true);
	});

	test("escapes regex special characters in promise", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "<promise>DONE.NOW</promise>",
						},
					},
				},
			],
		});

		// Should match literally, not as regex
		expect(checkCompletionPromise(session, "DONE.NOW")).toBe(true);
		// Without escaping, this would match "DONE<any-char>NOW"
		expect(checkCompletionPromise(session, "DONEXNOW")).toBe(false);
	});

	test("returns false for empty history", () => {
		const session = KiroSessionSchema.parse({ history: [] });
		expect(checkCompletionPromise(session, "COMPLETE")).toBe(false);
	});
});
