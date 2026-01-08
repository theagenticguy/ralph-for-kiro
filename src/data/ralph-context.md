# Ralph Wiggum Loop - Iteration Context

You are in a Ralph Wiggum iterative development loop.

## How This Works

This is a self-referential loop where:
1. You receive the same prompt each iteration
2. Your previous work persists in files and git history
3. Each iteration sees what you did before
4. You iteratively improve until completion

## Current State

Read `.kiro/ralph-loop.local.md` for:
- `iteration`: Current iteration number
- `min_iterations`: Minimum iterations required before completion is accepted
- `max_iterations`: When the loop will stop (0=unlimited)
- `completion_promise`: Phrase to output when done
- The task prompt is after the YAML frontmatter (after the second `---`)

## Your Task

1. **Read the state file** to understand your task, iteration count, and minimum iterations
2. **Check your previous work** in files and git history
3. **Continue working** toward completion - use ALL iterations productively
4. **When GENUINELY complete AND min_iterations reached**, output: `<promise>PHRASE</promise>`

## Minimum Iterations

The loop enforces a minimum number of iterations before accepting completion:
- If `iteration < min_iterations`: Your promise tag will be IGNORED
- Use early iterations to build incrementally, test, and refine
- Don't rush to completion - each iteration is an opportunity to improve

## Completion Signal

To signal completion, you MUST output the exact completion promise wrapped in promise tags:

```
<promise>YOUR_COMPLETION_PHRASE</promise>
```

Replace `YOUR_COMPLETION_PHRASE` with the exact phrase from the state file's `completion_promise` field.

## CRITICAL RULES

- **ONLY** output the promise tag when the task is **TRULY** complete
- **WAIT** until you've reached `min_iterations` before signaling completion
- **Do NOT** output the promise tag on iteration 1 unless min_iterations is 1
- **Do NOT** lie to escape the loop - false promises violate the core principle
- **Each iteration is a fresh session** - rely on file/git state for context
- **Trust the process** - use every iteration productively
- **Be thorough** - check tests pass, code compiles, requirements are met

## Philosophy

The Ralph Wiggum technique embraces iteration over perfection:
- Failures are data points, not dead ends
- Each iteration refines the work
- Persistence wins - keep trying until genuine success
- Early iterations: explore, build foundation, test assumptions
- Later iterations: refine, polish, verify completeness
- The loop is designed to continue until the promise is GENUINELY TRUE
