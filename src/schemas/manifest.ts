/**
 * @fileoverview Watch manifest schema for project-watcher.
 * Defines the structure of watch-manifest.json.
 * @module schemas/manifest
 */
import { z } from "zod";

/**
 * Schema for a watched repository entry.
 */
export const WatchEntrySchema = z.object({
	/** Repository in owner/name format */
	repo: z.string().min(1),
	/** ISO date when added */
	added: z.string(),
	/** How this repo was added */
	source: z.enum(["manual", "discovered"]),
	/** Topic tags */
	tags: z.array(z.string()).default([]),
	/** ISO date when last seen in a discovery run */
	lastSeen: z.string().optional(),
	/** Number of discovery runs that surfaced this repo */
	discoveryCount: z.number().int().min(0).default(0),
	/** Run ID that first discovered this repo */
	runId: z.string().optional(),
});

/**
 * Schema for a discovery log entry.
 */
export const DiscoveryLogEntrySchema = z.object({
	/** Task ID of the run */
	runId: z.string(),
	/** ISO date of the run */
	date: z.string(),
	/** Number of repos auto-added */
	reposAdded: z.number().int().min(0).default(0),
	/** Number of existing repos with updated lastSeen */
	reposUpdated: z.number().int().min(0).default(0),
	/** Number of repos suggested for pruning */
	pruningSuggested: z.number().int().min(0).default(0),
});

/**
 * Schema for discovery thresholds.
 */
export const ThresholdsSchema = z.object({
	/** Minimum stars to consider a repo */
	minStars: z.number().int().min(0).default(50),
	/** Stars threshold for auto-adding to watch list */
	autoAddStars: z.number().int().min(0).default(500),
	/** Maximum age in days for "new" repos */
	maxAgeDays: z.number().int().min(1).default(30),
});

/**
 * Schema for the watch manifest file.
 */
export const WatchManifestSchema = z.object({
	/** Manifest version */
	version: z.string().default("1.0"),
	/** Topics of interest for discovery */
	topics: z.array(z.string()).min(1, "At least one topic is required"),
	/** Programming languages to prioritize */
	languages: z.array(z.string()).default([]),
	/** Currently watched repositories */
	watch: z.array(WatchEntrySchema).default([]),
	/** Scoring and auto-add thresholds */
	thresholds: ThresholdsSchema.default(() => ({
		minStars: 50,
		autoAddStars: 500,
		maxAgeDays: 30,
	})),
	/** Append-only log of discovery runs (capped at 50) */
	discoveryLog: z.array(DiscoveryLogEntrySchema).default([]),
});

export type WatchManifest = z.infer<typeof WatchManifestSchema>;
export type WatchEntry = z.infer<typeof WatchEntrySchema>;
export type DiscoveryLogEntry = z.infer<typeof DiscoveryLogEntrySchema>;
