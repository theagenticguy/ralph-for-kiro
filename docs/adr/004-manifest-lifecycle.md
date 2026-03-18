# ADR-004: Manifest Lifecycle — Growth, Staleness, and Pruning

## Status

Accepted

## Context

The watch manifest (`watch-manifest.json`) starts with a handful of manually-added repos and topics. Over multiple discovery runs, the agent finds new repos. The manifest needs to evolve as a living document — growing when the agent discovers high-signal repos, tracking freshness so the user knows what's active, and eventually pruning repos that are no longer relevant.

Without lifecycle management, the manifest either stays static (user must manually curate) or grows unbounded (agent adds everything, signal drowns in noise).

## Decision

### Growth: Auto-Add with Provenance

When the agent discovers a repo that exceeds the `autoAddStars` threshold during a watch run, it adds it to the manifest's `watch` array with full provenance:

```json
{
  "repo": "owner/name",
  "added": "2026-03-18",
  "source": "discovered",
  "tags": ["ai-agents", "mcp"],
  "lastSeen": "2026-03-18",
  "discoveryCount": 1,
  "runId": "pw-20260318-2200"
}
```

- `source: "discovered"` distinguishes auto-added repos from manual entries
- `lastSeen` tracks when the repo last appeared in a discovery run
- `discoveryCount` tracks how many runs have surfaced this repo (cross-source signal)
- `runId` records which run discovered it

Manual entries (`source: "manual"`) are never auto-removed. They are the user's explicit intent.

### Freshness: Last-Seen Tracking

On every watch run, the agent updates `lastSeen` for repos it encounters across its searches. This happens whether or not the repo is new — existing watch entries get their `lastSeen` bumped and `discoveryCount` incremented.

A repo's freshness is derived from `lastSeen` relative to the current date:
- **Active**: seen in the last 30 days
- **Stale**: not seen in 30-90 days
- **Dormant**: not seen in 90+ days

### Pruning: Agent-Suggested, User-Confirmed

The agent does NOT auto-remove repos. Instead, at the end of each run it:

1. Flags repos where `source: "discovered"` AND `lastSeen` is stale (>90 days)
2. Writes a `pruning-suggestions` section in the run summary
3. Lists the candidate repos with reasoning (no recent activity, low star velocity, superseded by alternatives)

The user reviews and manually removes entries, or runs `ralph watch prune` to accept all suggestions.

This is intentionally conservative — removing a repo from the watch list is a destructive action that should require human judgment.

### Discovery Log: Append-Only History

Each watch run appends to `watch-manifest.json`'s `discoveryLog` array:

```json
{
  "discoveryLog": [
    {
      "runId": "pw-20260318-2200",
      "date": "2026-03-18",
      "reposAdded": 3,
      "reposUpdated": 8,
      "reposSuggested": 5,
      "pruningSuggested": 1
    }
  ]
}
```

This gives the user a timeline of how the manifest evolved. The log is capped at the last 50 entries to prevent unbounded growth.

## Consequences

- The manifest is a living document that gets richer over time
- Manual entries are sacred — never auto-modified or removed
- Discovered entries carry full provenance for auditability
- Staleness is visible in the manifest itself (users can grep for stale repos)
- Pruning requires human confirmation, preventing accidental data loss
- The discovery log provides accountability for how the manifest evolved
- Git-tracking the manifest shows the full history of changes via diffs
