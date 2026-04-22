/**
 * @fileoverview Path constants + user-directory resolution for Ralph Wiggum CLI.
 *
 * The "user directory" is where a user's scouts and results live. It's
 * resolved once per process via {@link resolveUserDir} and frozen by
 * {@link setUserDir}. All path helpers below that depend on scouts/results
 * location read from {@link getUserDir}.
 *
 * Resolution order (highest wins):
 *   1. --user-dir <path> CLI flag (set via setUserDir)
 *   2. RALPH_USER_DIR env var
 *   3. $XDG_CONFIG_HOME/ralph-for-kiro/ (or ~/.config/ralph-for-kiro/)
 *   4. process.cwd() — legacy repo-clone fallback
 *
 * Mode 4 is the backwards-compat layer so nightly crons pointed at an
 * existing repo keep working without change.
 *
 * @module utils/paths
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Kiro configuration directory (relative to project root) */
export const KIRO_DIR = ".kiro";

/** Directory for kiro agent configurations */
export const KIRO_AGENTS_DIR = join(KIRO_DIR, "agents");

/** Directory for kiro steering files */
export const KIRO_STEERING_DIR = join(KIRO_DIR, "steering");

/** Path to the Ralph loop state file (JSON format) */
export const STATE_FILE = join(KIRO_DIR, "ralph-loop.local.json");

/** Path to the Ralph session file */
export const SESSION_FILE = join(KIRO_DIR, "ralph-session.json");

/** Kiro CLI data directory in user's home */
export const KIRO_DATA_DIR = join(homedir(), ".local", "share", "kiro-cli");

/** Path to the Kiro CLI SQLite database */
export const KIRO_DB_PATH = join(KIRO_DATA_DIR, "data.sqlite3");

/** Default agent name for Ralph loops */
export const DEFAULT_AGENT_NAME = "ralph-wiggum";

/** Path to the default Ralph agent configuration */
export const AGENT_CONFIG_PATH = join(KIRO_AGENTS_DIR, "ralph-wiggum.json");

/** Directory for kiro settings (MCP config, etc.) */
export const KIRO_SETTINGS_DIR = join(KIRO_DIR, "settings");

/** Directory for kiro lifecycle hook scripts */
export const KIRO_HOOKS_DIR = join(KIRO_DIR, "hooks");

/** Default agent name for watch runs */
export const WATCH_AGENT_NAME = "project-watcher";

// ---------------------------------------------------------------------------
// User directory resolution
// ---------------------------------------------------------------------------

/** Explicit override from the --user-dir CLI flag. Wins over env. */
let cliUserDir: string | null = null;

/**
 * Register an explicit user-dir from the CLI flag. Resolved once at process
 * startup by the commander preSubcommand hook in src/index.ts.
 */
export function setUserDir(path: string | null): void {
	cliUserDir = path ? resolve(path) : null;
}

/**
 * Resolve the active user directory following the documented precedence.
 * Pure (no side effects) — reads the cliUserDir module state + env + home.
 */
export function resolveUserDir(): string {
	if (cliUserDir) return cliUserDir;

	const envDir = process.env["RALPH_USER_DIR"];
	if (envDir?.trim()) return resolve(envDir);

	const xdg = process.env["XDG_CONFIG_HOME"];
	const xdgDir = xdg?.trim()
		? join(resolve(xdg), "ralph-for-kiro")
		: join(homedir(), ".config", "ralph-for-kiro");

	// Only honor the XDG default when it already exists — otherwise fall
	// through to the legacy repo-clone fallback so existing crons keep
	// working without having to mkdir ~/.config/ralph-for-kiro first.
	if (xdgDirExists(xdgDir)) return xdgDir;

	return process.cwd();
}

/**
 * Cheap existence check that returns false on any error (permissions,
 * missing parent, etc.). Bun.file().size is non-zero for dirs, so we use
 * statSync via Bun.file under the node:fs readdirSync path instead.
 */
function xdgDirExists(path: string): boolean {
	// Using node:fs sync API here — this is called during path resolution,
	// which happens before any async entrypoints.
	try {
		const fs = require("node:fs") as typeof import("node:fs");
		return fs.existsSync(path);
	} catch {
		return false;
	}
}

/** Get the active user directory. Cheap; safe to call repeatedly. */
export function getUserDir(): string {
	return resolveUserDir();
}

/** Absolute path to `<user-dir>/scouts/`. */
export function scoutsDir(): string {
	return join(getUserDir(), "scouts");
}

/** Absolute path to `<user-dir>/results/`. */
export function resultsDir(): string {
	return join(getUserDir(), "results");
}

/** Absolute path to `<user-dir>/watch-manifest.json`. */
export function watchManifestFile(): string {
	return join(getUserDir(), "watch-manifest.json");
}
