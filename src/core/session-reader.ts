/**
 * @fileoverview SQLite session reader for Kiro CLI.
 * Reads conversation history from Kiro's SQLite database.
 * @module core/session-reader
 */
import { Database } from "bun:sqlite";
import { resolve } from "node:path";
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

	let db: Database | null = null;
	try {
		// Use bun:sqlite Database class (more stable than Bun.SQL tagged templates)
		db = new Database(KIRO_DB_PATH, { readonly: true });

		// Query with prepared statement
		const stmt = db.prepare(`
			SELECT value FROM conversations_v2
			WHERE key = ?
			ORDER BY created_at DESC
			LIMIT 1
		`);

		const row = stmt.get(targetDir) as { value: string } | null;

		if (!row) {
			return null;
		}

		// Parse JSON and validate with Zod schema
		const sessionJson = JSON.parse(row.value);
		return KiroSessionSchema.parse(sessionJson);
	} catch (error) {
		console.warn(`Warning: Could not read session: ${error}`);
		return null;
	} finally {
		// Close database connection
		db?.close();
	}
}

/**
 * Path to the Kiro SQLite database.
 * Re-exported for testing purposes.
 */
export { KIRO_DB_PATH };
