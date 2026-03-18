/**
 * @fileoverview Results schemas for project-watcher.
 * Defines the structure of discovery.json and status.json.
 * @module schemas/results
 */
import { z } from "zod";

/**
 * Schema for a discovered repository.
 */
export const DiscoveryEntrySchema = z.object({
	/** Repository in owner/name format */
	repo: z.string(),
	/** GitHub URL */
	url: z.string().url(),
	/** Repository description */
	description: z.string().default(""),
	/** Star count at time of discovery */
	stars: z.number().int().min(0).default(0),
	/** Primary language */
	language: z.string().default(""),
	/** Topics/tags */
	topics: z.array(z.string()).default([]),
	/** Which search sources found this repo */
	sources: z.array(z.string()).default([]),
	/** Which iteration discovered this repo */
	discoveredIteration: z.number().int().min(1).default(1),
	/** Analysis depth: shallow, medium, deep */
	depth: z.enum(["shallow", "medium", "deep"]).default("shallow"),
	/** Agent's analysis or notes about the repo */
	analysis: z.string().default(""),
	/** Related repos discovered through this one */
	adjacentTo: z.array(z.string()).default([]),
	/** Why this repo is interesting */
	reasoning: z.string().default(""),
	/** Whether it was auto-added to the manifest */
	autoAdded: z.boolean().default(false),
});

/**
 * Schema for discovery run statistics.
 */
export const DiscoveryStatsSchema = z.object({
	/** Total search results processed */
	totalSearched: z.number().int().min(0).default(0),
	/** Total unique repos discovered */
	totalDiscovered: z.number().int().min(0).default(0),
	/** Repos auto-added to manifest */
	autoAdded: z.number().int().min(0).default(0),
	/** MCP sources used */
	sourcesUsed: z.array(z.string()).default([]),
});

/**
 * Schema for the discovery results file.
 */
export const DiscoveryResultsSchema = z.object({
	/** Task ID for this run */
	taskId: z.string(),
	/** Number of iterations completed */
	iterationsCompleted: z.number().int().min(0).default(0),
	/** ISO timestamp */
	timestamp: z.string().default(() => new Date().toISOString()),
	/** Discovered repositories */
	discoveries: z.array(DiscoveryEntrySchema).default([]),
	/** Concepts and topics explored */
	conceptsExplored: z.array(z.string()).default([]),
	/** Research questions that were answered */
	researchQuestionsAnswered: z.array(z.string()).default([]),
	/** Run statistics */
	stats: DiscoveryStatsSchema.default(() => ({
		totalSearched: 0,
		totalDiscovered: 0,
		autoAdded: 0,
		sourcesUsed: [],
	})),
});

/**
 * Schema for the run status file.
 */
export const WatchStatusSchema = z.object({
	/** Task ID */
	taskId: z.string(),
	/** Run status */
	status: z.enum(["running", "complete", "failed"]),
	/** ISO timestamp when started */
	startedAt: z.string(),
	/** ISO timestamp when completed (if done) */
	completedAt: z.string().nullable().default(null),
	/** Current iteration */
	currentIteration: z.number().int().min(0).default(0),
	/** Max iterations configured */
	maxIterations: z.number().int().min(0).default(10),
	/** Repos discovered so far */
	reposDiscovered: z.number().int().min(0).default(0),
	/** Repos auto-added */
	reposAdded: z.number().int().min(0).default(0),
	/** Error message if failed */
	error: z.string().nullable().default(null),
});

export type DiscoveryEntry = z.infer<typeof DiscoveryEntrySchema>;
export type DiscoveryResults = z.infer<typeof DiscoveryResultsSchema>;
export type WatchStatus = z.infer<typeof WatchStatusSchema>;
