# Spec: Watch Command

## Summary

Add a `ralph watch` command that discovers trending GitHub repositories through iterative deep research using Kiro CLI with existing MCP search servers (exa, brave-search, tavily).

## Requirements

### REQ-1: Watch Run (Default Action)
When the user runs `ralph watch`, the system SHALL:
- Generate a unique task ID (format: `pw-YYYYMMDD-HHmm`)
- Create a results directory at `results/<task-id>/` with an `iterations/` subdirectory
- Read `watch-manifest.json` for topics, languages, and thresholds
- Build a prompt containing the manifest contents and results folder path
- Start a ralph loop (min 3, max 10 iterations) using the `project-watcher` Kiro agent
- Write a `status.json` file tracking run progress
- Support `--max-iterations` and `--min-iterations` flags to override defaults

### REQ-2: Watch Init
When the user runs `ralph watch init`, the system SHALL:
- Create `.kiro/agents/project-watcher.json` (agent config)
- Create `.kiro/steering/watcher-context.md` (steering file)
- Create `.kiro/settings/mcp.json` from `.mcp.json.example` if it doesn't exist
- Create `watch-manifest.json` from `watch-manifest.example.json` if it doesn't exist
- Support `--force` to overwrite existing files

### REQ-3: Watch Results
When the user runs `ralph watch results [id]`, the system SHALL:
- If no ID provided, show results from the most recent run
- Read and display `summary.md` if the run is complete
- Read and display `status.json` if the run is still in progress
- Show iteration count and discovery count from status

### REQ-4: Watch List
When the user runs `ralph watch ls`, the system SHALL:
- Scan the `results/` directory for task folders
- Display each run with: task ID, status, iteration count, discovery count, timestamp
- Sort by most recent first

### REQ-5: Results File Structure
Each watch run SHALL produce:
- `results/<task-id>/status.json` - Run metadata and status
- `results/<task-id>/discovery.json` - Accumulated discoveries across iterations
- `results/<task-id>/iterations/NN-description.md` - Per-iteration snapshots
- `results/<task-id>/summary.md` - Final synthesis (on completion)

### REQ-6: Manifest Schema
The `watch-manifest.json` file SHALL contain:
- `version` (string): Manifest version
- `topics` (string[]): Topics of interest for discovery
- `languages` (string[]): Programming languages to prioritize
- `watch` (array): Currently watched repositories with repo, added date, source, and tags
- `thresholds` (object): minStars, autoAddStars, maxAgeDays

### REQ-8: Manifest Lifecycle — Growth
The agent SHALL auto-add repos to `watch-manifest.json` when:
- The repo exceeds the `autoAddStars` threshold
- The repo is not already in the watch list
- Auto-added entries SHALL include: `source: "discovered"`, `lastSeen`, `discoveryCount`, `runId`

### REQ-9: Manifest Lifecycle — Freshness Tracking
On each watch run, the agent SHALL:
- Update `lastSeen` to the current date for every watched repo it encounters in search results
- Increment `discoveryCount` for repos seen again
- Freshness categories: Active (<30d), Stale (30-90d), Dormant (>90d)

### REQ-10: Manifest Lifecycle — Pruning Suggestions
The agent SHALL NOT auto-remove repos. Instead it SHALL:
- Flag `source: "discovered"` repos where `lastSeen` exceeds 90 days
- Include a "Pruning Suggestions" section in `summary.md` with reasoning
- Manual entries (`source: "manual"`) are never flagged for pruning

### REQ-11: Discovery Log
The manifest SHALL include a `discoveryLog` array (capped at 50 entries) with:
- `runId`, `date`, `reposAdded`, `reposUpdated`, `pruningSuggested`

### REQ-7: Open Source Safety
The repository SHALL NOT commit:
- API keys or secrets
- `.kiro/settings/mcp.json` (contains API key references)
- `watch-manifest.json` (user-specific)
- `results/` directory (run outputs)

The repository SHALL provide:
- `.mcp.json.example` with placeholder env var references
- `watch-manifest.example.json` with sample topics

## Design Decisions

See `docs/adr/` for architectural decision records:
- ADR-001: Watch command architecture (reuse existing loop runner)
- ADR-002: Iterative deepening research strategy
- ADR-003: Reuse existing MCP servers (no custom MCP)
- ADR-004: Manifest lifecycle — growth, staleness, and pruning

## Files Changed

### New Files
- `src/commands/watch.ts` - Watch command handlers
- `src/core/watch-runner.ts` - Watch-specific loop orchestration
- `src/schemas/manifest.ts` - Manifest Zod schema
- `src/schemas/results.ts` - Results Zod schemas
- `src/data/project-watcher.json` - Kiro agent config template
- `src/data/watcher-context.md` - Steering file template
- `.mcp.json.example` - Example MCP server config
- `watch-manifest.example.json` - Example watch manifest
- `docs/adr/001-watch-command-architecture.md`
- `docs/adr/002-iterative-deepening-research.md`
- `docs/adr/003-reuse-existing-mcp-servers.md`

### Modified Files
- `src/index.ts` - Register watch command
- `src/commands/index.ts` - Export watch command
- `src/schemas/index.ts` - Export new schemas
- `src/utils/paths.ts` - Add watch-specific path constants
- `.gitignore` - Add results/, mcp.json, watch-manifest.json
