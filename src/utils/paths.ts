/**
 * @fileoverview Path constants for Ralph Wiggum CLI.
 * @module utils/paths
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** Kiro configuration directory (relative to project root) */
export const KIRO_DIR = ".kiro";

/** Directory for kiro agent configurations */
export const KIRO_AGENTS_DIR = join(KIRO_DIR, "agents");

/** Directory for kiro steering files */
export const KIRO_STEERING_DIR = join(KIRO_DIR, "steering");

/** Path to the Ralph loop state file (markdown with YAML frontmatter) */
export const STATE_FILE = join(KIRO_DIR, "ralph-loop.local.md");

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
