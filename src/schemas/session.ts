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
		user: z.record(z.unknown()).nullable().optional(),
		/** Assistant response in the turn (optional) */
		assistant: z.record(z.unknown()).nullable().optional(),
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
