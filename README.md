# Ralph Wiggum for Kiro CLI

Implementation of the [Ralph Wiggum technique](https://ghuntley.com/ralph/) for iterative, self-referential AI development loops in Kiro CLI.

## What is Ralph?

Ralph is a development methodology based on continuous AI agent loops. As Geoffrey Huntley describes it: **"Ralph is a Bash loop"** - a simple `while true` that repeatedly feeds an AI agent a prompt, allowing it to iteratively improve its work until completion.

The technique is named after Ralph Wiggum from The Simpsons, embodying the philosophy of persistent iteration despite setbacks.

### Core Concept

```bash
while true; do
  cat PROMPT.md | kiro-cli chat --agent ralph-wiggum --no-interactive
  # Check for completion
done
```

This creates a **self-referential feedback loop** where:
- The prompt never changes between iterations
- The agent's previous work persists in files
- Each iteration sees modified files and git history
- The agent autonomously improves by reading its own past work

## Installation

```bash
# Clone and install
git clone <this-repo>
cd ralph-wiggum
uv sync

# Or install as a tool
uv tool install .
```

## Quick Start

```bash
# Initialize Ralph in your project (creates .kiro/agents/ and .kiro/steering/)
ralph init

# Start a Ralph loop
ralph loop "Build a REST API for todos with CRUD operations and tests" \
  --completion-promise "COMPLETE" \
  --max-iterations 20
```

The agent will:
1. Work on the task iteratively
2. See its previous work in files/git each iteration
3. Continue until it outputs `<promise>COMPLETE</promise>`
4. Or stop when max iterations is reached

## Commands

### `ralph init`

Initialize Ralph Wiggum in the current project.

```bash
ralph init [--force]
```

Creates:
- `.kiro/agents/ralph-wiggum.json` - Kiro agent configuration
- `.kiro/steering/ralph-context.md` - Agent steering/context file

**Options:**
- `--force` - Overwrite existing files if they exist

### `ralph loop`

Start a Ralph loop.

```bash
ralph loop <PROMPT> [OPTIONS]
```

**Arguments:**
- `PROMPT` - Task description for the agent

**Options:**
- `--max-iterations, -m` - Max iterations before auto-stop (default: 0=unlimited)
- `--completion-promise, -p` - Phrase that signals completion
- `--agent, -a` - Path to custom agent config

**Examples:**

```bash
# Basic loop with iteration limit
ralph loop "Fix the authentication bug" -m 10

# Loop with completion promise
ralph loop "Add input validation" -p "VALIDATION COMPLETE" -m 20

# Custom agent config
ralph loop "Build feature X" -a ./my-agent.json -m 15
```

### `ralph cancel`

Cancel an active Ralph loop.

```bash
ralph cancel
```

## How It Works

1. **State File**: Loop state is stored in `.kiro/ralph-loop.local.md`
   - Contains iteration count, settings, and the original prompt
   - Agent reads this to understand its task

2. **Session Parsing**: After each iteration, the session is saved to `.kiro/ralph-session.json`
   - Parsed to check for completion promise in agent output
   - Uses Pydantic models for robust JSON parsing

3. **Stop Hook**: The Kiro agent has a stop hook that saves the session
   - Enables completion detection between iterations

4. **Completion Detection**: The loop checks for `<promise>PHRASE</promise>` in the last assistant message
   - Only exact matches trigger completion
   - Agent must genuinely complete the task to exit

## Prompt Writing Best Practices

### Clear Completion Criteria

❌ Bad:
```
Build a todo API and make it good.
```

✅ Good:
```
Build a REST API for todos.

When complete:
- All CRUD endpoints working
- Input validation in place
- Tests passing (coverage > 80%)
- Output: <promise>COMPLETE</promise>
```

### Incremental Goals

❌ Bad:
```
Create a complete e-commerce platform.
```

✅ Good:
```
Phase 1: User authentication (JWT, tests)
Phase 2: Product catalog (list/search, tests)
Phase 3: Shopping cart (add/remove, tests)

Output <promise>COMPLETE</promise> when all phases done.
```

### Safety Nets

Always use `--max-iterations` to prevent infinite loops:

```bash
# Recommended: Always set a reasonable limit
ralph loop "Your task" --max-iterations 20 --completion-promise "DONE"
```

## Philosophy

Ralph embodies several key principles:

1. **Iteration > Perfection** - Don't aim for perfect on first try
2. **Failures Are Data** - Use them to tune prompts
3. **Operator Skill Matters** - Success depends on good prompts
4. **Persistence Wins** - Keep trying until success

## When to Use Ralph

**Good for:**
- Well-defined tasks with clear success criteria
- Tasks requiring iteration and refinement
- Greenfield projects where you can walk away
- Tasks with automatic verification (tests, linters)

**Not good for:**
- Tasks requiring human judgment
- One-shot operations
- Tasks with unclear success criteria
- Production debugging

## Architecture

```
ralph-wiggum/
├── src/ralph_wiggum/
│   ├── cli.py              # Cyclopts CLI
│   ├── commands/
│   │   ├── init.py         # Init command (creates .kiro/)
│   │   ├── loop.py         # Loop command
│   │   └── cancel.py       # Cancel command
│   ├── core/
│   │   ├── loop_runner.py  # Main loop logic
│   │   └── kiro_client.py  # Kiro subprocess wrapper
│   ├── models/
│   │   ├── config.py       # CLI config (Pydantic)
│   │   ├── state.py        # Loop state (Pydantic)
│   │   └── session.py      # Session parsing (Pydantic)
│   ├── hooks/
│   │   └── stop_hook.py    # Kiro stop hook
│   └── data/               # Bundled data files
│       ├── ralph-wiggum.json
│       └── ralph-context.md
```

After running `ralph init`, your project will have:

```
your-project/
└── .kiro/
    ├── agents/
    │   └── ralph-wiggum.json   # Kiro agent config
    └── steering/
        └── ralph-context.md    # Agent steering context
```

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- [Kiro CLI](https://kiro.dev/) installed and authenticated

## Learn More

- [Original technique by Geoffrey Huntley](https://ghuntley.com/ralph/)
- [Ralph Orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)
- [Kiro CLI Documentation](https://kiro.dev/docs/cli/)

## License

MIT
