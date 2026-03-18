# ADR-001: Watch Command Architecture

## Status

Accepted

## Context

We need a way to discover trending GitHub repositories matching specific topics and languages. The discovery should run overnight (fire-and-forget) and produce results retrievable by task ID the next morning.

Ralph-for-kiro already provides an iterative loop mechanism with completion promises, feedback extraction, and Kiro CLI subprocess management. We need to decide how to integrate the watch functionality.

## Decision

Add a `ralph watch` command that reuses the existing loop runner infrastructure. The watch command:

- Generates a task ID (e.g. `pw-20260318-2200`) and creates a results folder
- Reads a `watch-manifest.json` for topics, languages, and thresholds
- Builds a prompt with manifest context and instructs the Kiro agent to write results
- Delegates to the existing `runLoop()` with watch-specific defaults (min 3, max 10 iterations)
- The Kiro agent writes `discovery.json`, iteration snapshots, and `summary.md` directly to the results folder

Subcommands: `ralph watch` (run), `ralph watch init`, `ralph watch results [id]`, `ralph watch ls`.

## Consequences

- Reuses all existing loop infrastructure (loop-runner, kiro-client, session-reader, feedback extraction)
- Watch-specific code is isolated in `src/commands/watch.ts` and `src/core/watch-runner.ts`
- The Kiro agent is responsible for writing results files (not the TypeScript CLI), keeping the CLI thin
- Results are file-based and git-trackable
