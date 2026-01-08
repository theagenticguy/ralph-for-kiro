import { describe, expect, test } from "bun:test";
import { LoopConfigSchema } from "../src/schemas/config.ts";
import {
	KiroSessionSchema,
	checkCompletionPromise,
	extractRalphFeedback,
	extractTagContent,
	getAssistantText,
	getLastAssistantText,
	parseBulletList,
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

describe("extractTagContent", () => {
	test("extracts content from simple tag", () => {
		const text = "Some text <tag>content here</tag> more text";
		expect(extractTagContent(text, "tag")).toBe("content here");
	});

	test("extracts multiline content", () => {
		const text = "<tag>\nline1\nline2\n</tag>";
		expect(extractTagContent(text, "tag")).toBe("line1\nline2");
	});

	test("case insensitive tag matching", () => {
		const text = "<TAG>content</TAG>";
		expect(extractTagContent(text, "tag")).toBe("content");
	});

	test("returns null for missing tag", () => {
		const text = "no tags here";
		expect(extractTagContent(text, "tag")).toBeNull();
	});

	test("extracts first occurrence only", () => {
		const text = "<tag>first</tag> <tag>second</tag>";
		expect(extractTagContent(text, "tag")).toBe("first");
	});

	test("trims whitespace from content", () => {
		const text = "<tag>  content with spaces  </tag>";
		expect(extractTagContent(text, "tag")).toBe("content with spaces");
	});
});

describe("parseBulletList", () => {
	test("parses dash bullets", () => {
		const text = "- item 1\n- item 2\n- item 3";
		expect(parseBulletList(text)).toEqual(["item 1", "item 2", "item 3"]);
	});

	test("parses asterisk bullets", () => {
		const text = "* item 1\n* item 2";
		expect(parseBulletList(text)).toEqual(["item 1", "item 2"]);
	});

	test("handles mixed bullet styles", () => {
		const text = "- dash item\n* star item\n- another dash";
		expect(parseBulletList(text)).toEqual([
			"dash item",
			"star item",
			"another dash",
		]);
	});

	test("ignores non-bullet lines", () => {
		const text = "intro text\n- bullet\nnot a bullet\n- another";
		expect(parseBulletList(text)).toEqual(["bullet", "another"]);
	});

	test("handles empty input", () => {
		expect(parseBulletList("")).toEqual([]);
	});

	test("trims whitespace from items", () => {
		const text = "-   item with spaces   \n-item no space";
		expect(parseBulletList(text)).toEqual([
			"item with spaces",
			"item no space",
		]);
	});

	test("filters out empty items", () => {
		const text = "- valid\n-\n- also valid";
		expect(parseBulletList(text)).toEqual(["valid", "also valid"]);
	});
});

describe("extractRalphFeedback", () => {
	test("extracts full feedback structure", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: `Done with the task!
<ralph-feedback>
<quality-assessment>
<score>8</score>
<summary>Great progress today</summary>
</quality-assessment>
<improvements>
- Add more tests
- Refactor utils
</improvements>
<next-steps>
- Implement caching
</next-steps>
<ideas>
- Could add progress bar
</ideas>
<blockers>
- Need API key
</blockers>
</ralph-feedback>`,
						},
					},
				},
			],
		});

		const feedback = extractRalphFeedback(session);

		expect(feedback).not.toBeNull();
		expect(feedback?.qualityScore).toBe(8);
		expect(feedback?.qualitySummary).toBe("Great progress today");
		expect(feedback?.improvements).toEqual([
			"Add more tests",
			"Refactor utils",
		]);
		expect(feedback?.nextSteps).toEqual(["Implement caching"]);
		expect(feedback?.ideas).toEqual(["Could add progress bar"]);
		expect(feedback?.blockers).toEqual(["Need API key"]);
	});

	test("extracts partial feedback", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: `<ralph-feedback>
<quality-assessment>
<score>5</score>
</quality-assessment>
</ralph-feedback>`,
						},
					},
				},
			],
		});

		const feedback = extractRalphFeedback(session);

		expect(feedback).not.toBeNull();
		expect(feedback?.qualityScore).toBe(5);
		expect(feedback?.qualitySummary).toBeUndefined();
		expect(feedback?.improvements).toBeUndefined();
	});

	test("returns null when no feedback block", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "Just some regular response without feedback",
						},
					},
				},
			],
		});

		expect(extractRalphFeedback(session)).toBeNull();
	});

	test("returns null for empty history", () => {
		const session = KiroSessionSchema.parse({ history: [] });
		expect(extractRalphFeedback(session)).toBeNull();
	});

	test("returns null for empty feedback block", () => {
		const session = KiroSessionSchema.parse({
			history: [
				{
					assistant: {
						Response: {
							message_id: "1",
							content: "<ralph-feedback></ralph-feedback>",
						},
					},
				},
			],
		});

		expect(extractRalphFeedback(session)).toBeNull();
	});

	test("validates score range 1-10", () => {
		const createSession = (score: string) =>
			KiroSessionSchema.parse({
				history: [
					{
						assistant: {
							Response: {
								message_id: "1",
								content: `<ralph-feedback><quality-assessment><score>${score}</score></quality-assessment></ralph-feedback>`,
							},
						},
					},
				],
			});

		// Valid scores
		expect(extractRalphFeedback(createSession("1"))?.qualityScore).toBe(1);
		expect(extractRalphFeedback(createSession("10"))?.qualityScore).toBe(10);

		// Invalid scores should not be included
		expect(
			extractRalphFeedback(createSession("0"))?.qualityScore,
		).toBeUndefined();
		expect(
			extractRalphFeedback(createSession("11"))?.qualityScore,
		).toBeUndefined();
		expect(
			extractRalphFeedback(createSession("abc"))?.qualityScore,
		).toBeUndefined();
	});
});

describe("stateToMarkdown / stateFromMarkdown with previousFeedback", () => {
	test("round-trips state with previousFeedback", () => {
		const original = LoopStateSchema.parse({
			active: true,
			iteration: 2,
			minIterations: 1,
			maxIterations: 10,
			completionPromise: "DONE",
			startedAt: "2025-01-08T12:00:00.000Z",
			prompt: "Test task",
			previousFeedback: {
				qualityScore: 7,
				qualitySummary: "Good progress",
				improvements: ["Add tests", "Refactor code"],
				nextSteps: ["Implement feature"],
				ideas: ["Use caching"],
				blockers: ["Need API access"],
			},
		});

		const markdown = stateToMarkdown(original);
		const parsed = stateFromMarkdown(markdown);

		expect(parsed.previousFeedback).toBeDefined();
		expect(parsed.previousFeedback?.qualityScore).toBe(7);
		expect(parsed.previousFeedback?.qualitySummary).toBe("Good progress");
		expect(parsed.previousFeedback?.improvements).toEqual([
			"Add tests",
			"Refactor code",
		]);
		expect(parsed.previousFeedback?.nextSteps).toEqual(["Implement feature"]);
		expect(parsed.previousFeedback?.ideas).toEqual(["Use caching"]);
		expect(parsed.previousFeedback?.blockers).toEqual(["Need API access"]);
	});

	test("round-trips state without previousFeedback", () => {
		const original = LoopStateSchema.parse({
			active: true,
			iteration: 1,
			prompt: "First iteration",
		});

		const markdown = stateToMarkdown(original);
		const parsed = stateFromMarkdown(markdown);

		expect(parsed.previousFeedback).toBeUndefined();
	});

	test("serializes previous_feedback in snake_case", () => {
		const state = LoopStateSchema.parse({
			prompt: "Test",
			previousFeedback: {
				qualityScore: 8,
				qualitySummary: "Good work",
				nextSteps: ["Next step"],
			},
		});

		const markdown = stateToMarkdown(state);

		expect(markdown).toContain("previous_feedback:");
		expect(markdown).toContain("quality_score: 8");
		expect(markdown).toContain("quality_summary: Good work");
		expect(markdown).toContain("next_steps:");
	});
});
