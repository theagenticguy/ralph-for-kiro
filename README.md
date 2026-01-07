# Ralph Wiggum for Kiro CLI

Implementation of the [Ralph Wiggum technique](https://ghuntley.com/ralph/) for iterative, self-referential AI development loops in Kiro CLI.

> ⚠️ **IMPORTANT: Human Oversight Required**
>
> This tool runs Kiro CLI in a fully autonomous loop using `--no-interactive` and `--trust-all-tools` flags via subprocess. This means:
>
> - **The AI agent can execute ANY tool without confirmation** (file writes, shell commands, etc.)
> - **No human approval is required** between iterations
> - **The loop runs until completion or max iterations** - potentially for hours
>
> **You MUST monitor and review all output.** Do not leave Ralph running unattended on production systems or sensitive codebases. Always use `--max-iterations` to set a reasonable limit.
>
> **Requires:** Latest version of [Kiro CLI](https://kiro.dev/) installed and authenticated.

## What is Ralph Wiggum?

Ralph Wiggum is a development methodology based on continuous AI agent loops. As Geoffrey Huntley describes it: **"Ralph is a Bash loop"** - a simple `while true` that repeatedly feeds an AI agent a prompt, allowing it to iteratively improve its work until completion.

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

```mermaid
flowchart LR
    A[Prompt] --> B[AI Agent]
    B --> C[Code Changes]
    C --> D[Files & Git]
    D --> B
    B -->|"&lt;promise&gt;DONE&lt;/promise&gt;"| E[Complete]
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| CLI Framework | [Cyclopts](https://github.com/BrianPugh/cyclopts) | Command-line interface parsing |
| Data Validation | [Pydantic](https://docs.pydantic.dev/) | Models, serialization, validation |
| Configuration | [PyYAML](https://pyyaml.org/) | YAML frontmatter in state files |
| Terminal UI | [Rich](https://rich.readthedocs.io/) | Formatted console output |
| Package Manager | [uv](https://docs.astral.sh/uv/) | Fast Python package management |
| Task Runner | [mise](https://mise.jdx.dev/) | Development task automation |
| AI Backend | [Kiro CLI](https://kiro.dev/) | AI agent execution |
| Testing | [pytest](https://pytest.org/) + asyncio + xdist | Test framework with async & parallel support |

## Architecture

### Project Structure

```
ralph-wiggum/
├── src/ralph_wiggum/
│   ├── cli.py              # Cyclopts CLI entry point
│   ├── commands/           # CLI command implementations
│   │   ├── init.py         # Initialize Ralph in a project
│   │   ├── loop.py         # Start an iterative loop
│   │   └── cancel.py       # Cancel an active loop
│   ├── core/               # Core business logic
│   │   ├── loop_runner.py  # Main loop orchestration
│   │   ├── kiro_client.py  # Kiro CLI subprocess wrapper
│   │   └── session_reader.py # SQLite session reader
│   ├── models/             # Pydantic data models
│   │   ├── config.py       # Loop configuration
│   │   ├── state.py        # Loop state (markdown serialization)
│   │   └── session.py      # Kiro session parsing
│   └── data/               # Bundled template files
│       ├── ralph-wiggum.json  # Kiro agent config template
│       └── ralph-context.md   # Agent steering instructions
└── tests/                  # Test suite
```

### Component Diagram

```mermaid
graph TB
    subgraph CLI["CLI Layer"]
        A[cli.py] --> B[commands/init.py]
        A --> C[commands/loop.py]
        A --> D[commands/cancel.py]
    end

    subgraph Core["Core Layer"]
        E[loop_runner.py]
        F[kiro_client.py]
        G[session_reader.py]
    end

    subgraph Models["Models Layer"]
        H[config.py<br/>LoopConfig]
        I[state.py<br/>LoopState]
        J[session.py<br/>KiroSession]
    end

    subgraph External["External Systems"]
        K[(Kiro SQLite DB)]
        L[Kiro CLI]
    end

    C --> E
    E --> F
    E --> G
    E --> H
    E --> I
    G --> J
    G --> K
    F --> L
```

### Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Ralph CLI
    participant LoopRunner
    participant KiroClient
    participant Kiro CLI
    participant SQLite DB

    User->>Ralph CLI: ralph loop "Build API" -m 10
    Ralph CLI->>LoopRunner: run_loop(config)

    loop Each Iteration
        LoopRunner->>LoopRunner: Write state to<br/>.kiro/ralph-loop.local.md
        LoopRunner->>KiroClient: run_chat()
        KiroClient->>Kiro CLI: subprocess call
        Kiro CLI->>Kiro CLI: Agent works on task
        Kiro CLI-->>KiroClient: exit
        KiroClient-->>LoopRunner: complete
        LoopRunner->>SQLite DB: get_latest_session()
        SQLite DB-->>LoopRunner: KiroSession
        LoopRunner->>LoopRunner: check_completion_promise()

        alt Promise Found
            LoopRunner-->>Ralph CLI: Success
            Ralph CLI-->>User: Task complete!
        else Promise Not Found & iterations < max
            LoopRunner->>LoopRunner: Continue loop
        else Max iterations reached
            LoopRunner-->>Ralph CLI: Max iterations
            Ralph CLI-->>User: Stopped at limit
        end
    end
```

### State Machine

```mermaid
stateDiagram-v2
    [*] --> Initializing: ralph loop
    Initializing --> Running: Create state file

    Running --> CheckingPromise: Kiro CLI completes

    CheckingPromise --> Running: No promise &<br/>iterations < max
    CheckingPromise --> Completed: Promise found &<br/>iterations >= min
    CheckingPromise --> MaxReached: iterations >= max

    Running --> Cancelled: Ctrl+C or ralph cancel

    Completed --> [*]: Cleanup
    MaxReached --> [*]: Cleanup
    Cancelled --> [*]: Cleanup
```

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
- `--min-iterations, -n` - Minimum iterations before accepting completion (default: 1)
- `--max-iterations, -m` - Max iterations before auto-stop (default: 0=unlimited)
- `--completion-promise, -p` - Phrase that signals completion
- `--agent, -a` - Path to custom agent config

**Examples:**

```bash
# Basic loop with iteration limit
ralph loop "Fix the authentication bug" -m 10

# Loop with completion promise and minimum iterations
ralph loop "Add input validation" -p "VALIDATION COMPLETE" -n 3 -m 20

# Custom agent config
ralph loop "Build feature X" -a ./my-agent.json -m 15
```

### `ralph cancel`

Cancel an active Ralph loop.

```bash
ralph cancel
```

## How It Works

### 1. State File

Loop state is stored in `.kiro/ralph-loop.local.md` with YAML frontmatter:

```yaml
---
active: true
iteration: 3
min_iterations: 2
max_iterations: 20
completion_promise: COMPLETE
started_at: '2026-01-07T12:00:00Z'
---

Build a REST API with CRUD operations...
```

The agent reads this file to understand:
- Current iteration number
- When it's allowed to complete (after `min_iterations`)
- The completion phrase to output

### 2. Session Reading

After each Kiro CLI iteration:
- Ralph reads the session from Kiro's SQLite database (`~/.local/share/kiro-cli/data.sqlite3`)
- Parses the conversation history using Pydantic models
- Extracts the last assistant message

### 3. Completion Detection

The loop checks for `<promise>PHRASE</promise>` in the last assistant message:

```python
pattern = rf"<promise>\s*{re.escape(promise)}\s*</promise>"
```

- Case insensitive matching
- Flexible whitespace handling
- Only triggers after `min_iterations` reached

### 4. Minimum Iterations

The `--min-iterations` flag prevents premature completion:
- Agent must use early iterations productively
- Promise tags are ignored until minimum is reached
- Forces thorough work before declaring done

## Runtime Files

After running `ralph init`, your project will have:

```
your-project/
└── .kiro/
    ├── agents/
    │   └── ralph-wiggum.json   # Kiro agent config
    ├── steering/
    │   └── ralph-context.md    # Agent steering context
    └── ralph-loop.local.md     # Loop state (created during loop)
```

## Development

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/)
- [mise](https://mise.jdx.dev/) (optional, for task running)
- [Kiro CLI](https://kiro.dev/) installed and authenticated

### Recommended Kiro CLI Settings

For optimal Ralph Wiggum usage, configure your Kiro CLI settings in `~/.kiro/settings/cli.json`:

```json
{
  "chat.defaultModel": "claude-opus-4.5",
  "chat.greeting.enabled": false,
  "mcp.loadedBefore": true,
  "mcp.noInteractiveTimeout": 30000,
  "mcp.initTimeout": 30000,
  "chat.enableTodoList": true,
  "chat.enableDelegate": true,
  "chat.enableCheckpoint": true,
  "chat.enableThinking": true,
  "chat.enableContextUsageIndicator": true,
  "chat.enableKnowledge": true,
  "chat.enableTangentMode": true,
  "introspec.tangentMode": true
}
```

### Setup

```bash
uv sync
```

### Running Tests

```bash
# Using mise
mise run test              # Run all tests
mise run test:parallel     # Run tests in parallel (pytest-xdist)

# Using uv directly
uv run pytest              # Standard run
uv run pytest -n auto      # Parallel execution
```

### Available Tasks

| Task | Description |
|------|-------------|
| `mise run test` | Run tests |
| `mise run test:parallel` | Run tests in parallel |
| `mise run lint` | Run ruff linter |
| `mise run lint:fix` | Lint with auto-fix |
| `mise run format` | Format code |
| `mise run build` | Build the package |

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

## Learn More

- [Original technique by Geoffrey Huntley](https://ghuntley.com/ralph/)
- [Ralph Orchestrator](https://github.com/mikeyobrien/ralph-orchestrator)
- [Kiro CLI Documentation](https://kiro.dev/docs/cli/)

## License

MIT
