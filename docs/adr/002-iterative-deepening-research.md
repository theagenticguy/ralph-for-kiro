# ADR-002: Iterative Deepening via Ralph Loop

## Status

Accepted

## Context

A single-pass discovery scan is shallow. It finds repos but doesn't analyze them deeply, explore adjacent concepts, or follow citation chains. We need depth, not just breadth.

## Decision

Use ralph's iterative loop with completion promise as an iterative deepening research mechanism. Each iteration builds on the last:

- **Iterations 1-3 (Discovery):** Broad search across topics using MCP tools, find candidates, generate research questions
- **Iterations 4-7 (Deep Dive):** Analyze top repos, follow the graph (author's other work, competitors, related projects), surface adjacent concepts
- **Iterations 8-10 (Synthesis):** Compare approaches, identify patterns, write final summary, signal completion

Ralph's XML feedback mechanism (`<ralph-feedback>`) carries `nextSteps`, `ideas`, and `blockers` forward between iterations via the state file. This gives each new Kiro session full context of prior research.

The agent signals `<promise>COMPLETE</promise>` when research is saturated (no significant new leads) or when max iterations (default 10) is reached.

## Consequences

- Deep research emerges naturally from the loop — no special orchestration needed
- The steering file guides the research arc (broad → deep → synthesis)
- Each iteration snapshot is preserved in `results/<task-id>/iterations/`
- Quality improves with more iterations; the min-iterations setting (default 3) prevents premature completion
- Cost scales linearly with iterations — users can tune depth via `--max-iterations`
