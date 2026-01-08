import { resolve } from "node:path";
/**
 * @fileoverview SQLite session reader for Kiro CLI.
 * Reads conversation history from Kiro's SQLite database.
 * @module core/session-reader
 */
import { SQL } from "bun";
import { type KiroSession, KiroSessionSchema } from "../schemas/session";
import { KIRO_DB_PATH } from "../utils/paths";

/**
 * Retrieves the most recent session for a directory from Kiro's SQLite database.
 * @param cwd - Working directory to get session for. Defaults to process.cwd()
 * @returns The most recent KiroSession, or null if not found or on error
 * @example
 * ```typescript
 * const session = getLatestSession("/path/to/project");
 * if (session) {
 *   console.log(`Found session: ${session.conversation_id}`);
 * }
 * ```
 */
export function getLatestSession(cwd?: string): KiroSession | null {
	const targetDir = resolve(cwd ?? process.cwd());

	// Check if database exists
	const dbFile = Bun.file(KIRO_DB_PATH);
	if (!dbFile.size) {
		return null;
	}

	try {
		// Use Bun.SQL tagged template for SQLite
		const sql = new SQL(`sqlite://${KIRO_DB_PATH}`);

		// Query with tagged template (safe parameter binding)
		const rows = sql`
      SELECT value FROM conversations_v2
      WHERE key = ${targetDir}
      ORDER BY created_at DESC
      LIMIT 1
    `;

		// SQLite queries are synchronous in Bun.SQL but return array
		const result = rows as unknown as Array<{ value: string }>;

		if (!result.length) {
			return null;
		}

		// Parse JSON and validate with Zod schema
		const firstResult = result[0];
		if (!firstResult) {
			return null;
		}
		const sessionJson = JSON.parse(firstResult.value);
		return KiroSessionSchema.parse(sessionJson);
	} catch (error) {
		console.warn(`Warning: Could not read session: ${error}`);
		return null;
	}
}

/**
 * Path to the Kiro SQLite database.
 * Re-exported for testing purposes.
 */
export { KIRO_DB_PATH };
