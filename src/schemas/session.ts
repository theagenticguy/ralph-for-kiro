/**
 * @fileoverview KiroSession parsing and completion detection.
 * Defines schemas for parsing Kiro session data from SQLite.
 * @module schemas/session
 */
import { z } from "zod";

/**
 * Zod schema for a turn in the conversation history.
 * Uses passthrough to allow extra fields from Kiro.
 */
export const HistoryTurnSchema = z
	.object({
		/** User message in the turn (optional) */
		user: z.record(z.string(), z.unknown()).nullable().optional(),
		/** Assistant response in the turn (optional) */
		assistant: z.record(z.string(), z.unknown()).nullable().optional(),
	})
	.passthrough();

/**
 * A single turn in the conversation history.
 * Contains optional user and assistant messages.
 */
export type HistoryTurn = z.infer<typeof HistoryTurnSchema>;

/**
 * Zod schema for a Kiro session from SQLite database.
 * Validates the session structure returned from the database.
 */
export const KiroSessionSchema = z
	.object({
		/** Unique identifier for the conversation */
		conversation_id: z.string().default(""),
		/** Array of conversation turns */
		history: z.array(HistoryTurnSchema).default([]),
	})
	.passthrough();

/**
 * A Kiro session containing conversation history.
 * Retrieved from Kiro's SQLite database.
 */
export type KiroSession = z.infer<typeof KiroSessionSchema>;

/**
 * Structure of an assistant Response message.
 * Internal interface for type-safe access to response content.
 */
interface AssistantResponse {
	/** The Response object containing the message content */
	Response?: {
		/** Text content of the assistant's response */
		content?: string;
	};
}

/**
 * Extracts text from assistant Response message if present.
 * @param turn - A conversation turn to extract from
 * @returns The assistant's text content, or null if not present
 */
export function getAssistantText(turn: HistoryTurn): string | null {
	if (!turn.assistant) return null;

	const assistant = turn.assistant as AssistantResponse;
	if (assistant.Response) {
		return assistant.Response.content ?? null;
	}

	return null;
}

/**
 * Gets the text content of the last assistant Response in the session.
 * Iterates backwards through history to find the most recent response.
 * @param session - The Kiro session to search
 * @returns The last assistant's text content, or null if not found
 */
export function getLastAssistantText(session: KiroSession): string | null {
	for (let i = session.history.length - 1; i >= 0; i--) {
		const turn = session.history[i];
		if (turn) {
			const text = getAssistantText(turn);
			if (text) return text;
		}
	}
	return null;
}

/**
 * Checks if the last assistant response contains the completion promise.
 * Matches `<promise>PHRASE</promise>` pattern (case insensitive, flexible whitespace).
 * @param session - The Kiro session to check
 * @param promise - The completion phrase to look for
 * @returns True if the promise was found in the last response
 * @example
 * ```typescript
 * const completed = checkCompletionPromise(session, "DONE");
 * // Returns true if last response contains <promise>DONE</promise>
 * ```
 */
export function checkCompletionPromise(
	session: KiroSession,
	promise: string,
): boolean {
	const text = getLastAssistantText(session);
	if (!text) return false;

	// Use hardcoded regex to find promise tags, then compare content
	// This avoids ReDoS by not using dynamic RegExp construction
	const promisePattern = /<promise>\s*([\s\S]*?)\s*<\/promise>/gi;
	const matches = text.matchAll(promisePattern);
	const normalizedPromise = promise.trim().toLowerCase();

	for (const match of matches) {
		const content = match[1];
		if (content && content.trim().toLowerCase() === normalizedPromise) {
			return true;
		}
	}

	return false;
}

/**
 * Structured feedback extracted from assistant response.
 */
export interface RalphFeedback {
	qualityScore?: number;
	qualitySummary?: string;
	improvements?: string[];
	nextSteps?: string[];
	ideas?: string[];
	blockers?: string[];
}

/**
 * Sanitizes text by removing non-printable characters.
 * Keeps newlines, tabs, and standard printable ASCII/Unicode.
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
function sanitizeText(text: string): string {
	// Remove control characters except newline (\n, 0x0A), carriage return (\r, 0x0D), and tab (\t, 0x09)
	// Uses character code filtering to avoid lint warnings about control chars in regex
	return text
		.split("")
		.filter((char) => {
			const code = char.charCodeAt(0);
			// Allow tab (9), newline (10), carriage return (13), and printable chars (32+)
			// Block: 0-8, 11-12, 14-31, 127
			if (code === 9 || code === 10 || code === 13) return true;
			if (code < 32 || code === 127) return false;
			return true;
		})
		.join("");
}

/**
 * Extracts content between XML-like tags.
 * @param text - The text to search in
 * @param tagName - The tag name to look for
 * @returns The content between tags, or null if not found
 */
export function extractTagContent(
	text: string,
	tagName: string,
): string | null {
	const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
	const match = text.match(pattern);
	const content = match?.[1]?.trim() ?? null;
	// Sanitize to remove any binary/control characters
	return content ? sanitizeText(content) : null;
}

/**
 * Parses bullet points into array.
 * @param text - Text containing bullet points (- or *)
 * @returns Array of parsed bullet items
 */
export function parseBulletList(text: string): string[] {
	if (!text) return [];
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("-") || line.startsWith("*"))
		.map((line) => line.replace(/^[-*]\s*/, "").trim())
		.filter(Boolean);
}

/**
 * Extracts structured feedback from session.
 * @param session - The Kiro session to extract feedback from
 * @returns Extracted feedback, or null if no feedback block found
 */
export function extractRalphFeedback(
	session: KiroSession,
): RalphFeedback | null {
	const text = getLastAssistantText(session);
	if (!text) return null;

	const feedbackBlock = extractTagContent(text, "ralph-feedback");
	if (!feedbackBlock) return null;

	const feedback: RalphFeedback = {};

	// Quality assessment
	const qualityBlock = extractTagContent(feedbackBlock, "quality-assessment");
	if (qualityBlock) {
		const scoreText = extractTagContent(qualityBlock, "score");
		if (scoreText) {
			const score = Number.parseInt(scoreText, 10);
			if (!Number.isNaN(score) && score >= 1 && score <= 10) {
				feedback.qualityScore = score;
			}
		}
		feedback.qualitySummary =
			extractTagContent(qualityBlock, "summary") ?? undefined;
	}

	// Lists
	const improvements = extractTagContent(feedbackBlock, "improvements");
	if (improvements) feedback.improvements = parseBulletList(improvements);

	const nextSteps = extractTagContent(feedbackBlock, "next-steps");
	if (nextSteps) feedback.nextSteps = parseBulletList(nextSteps);

	const ideas = extractTagContent(feedbackBlock, "ideas");
	if (ideas) feedback.ideas = parseBulletList(ideas);

	const blockers = extractTagContent(feedbackBlock, "blockers");
	if (blockers) feedback.blockers = parseBulletList(blockers);

	// Return null if nothing extracted
	const hasContent =
		feedback.qualityScore !== undefined ||
		feedback.qualitySummary !== undefined ||
		(feedback.improvements?.length ?? 0) > 0 ||
		(feedback.nextSteps?.length ?? 0) > 0 ||
		(feedback.ideas?.length ?? 0) > 0 ||
		(feedback.blockers?.length ?? 0) > 0;

	return hasContent ? feedback : null;
}
