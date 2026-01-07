"""Main loop orchestration logic."""

import sys
from pathlib import Path

from rich.console import Console

from ralph_wiggum.core.kiro_client import KiroClient
from ralph_wiggum.core.session_reader import get_latest_session
from ralph_wiggum.models.config import LoopConfig
from ralph_wiggum.models.state import LoopState

STATE_FILE = Path(".kiro/ralph-loop.local.md")


def run_loop(config: LoopConfig, console: Console) -> None:
    """Run the Ralph loop.

    Parameters
    ----------
    config
        Loop configuration with prompt and settings.
    console
        Rich console for output.
    """
    client = KiroClient(agent_name=config.agent_name)
    cwd = Path.cwd()

    console.print("[bold blue]Ralph loop starting[/bold blue]")
    console.print(f"   Min iterations: {config.min_iterations}")
    console.print(f"   Max iterations: {config.max_iterations or 'unlimited'}")
    console.print(f"   Completion promise: {config.completion_promise}")
    console.print()

    iteration = 0
    try:
        while True:
            iteration += 1

            # Create/update state file
            state = LoopState(
                iteration=iteration,
                min_iterations=config.min_iterations,
                max_iterations=config.max_iterations,
                completion_promise=config.completion_promise,
                prompt=config.prompt,
            )
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            STATE_FILE.write_text(state.to_markdown())

            console.print(f"[yellow]Iteration {iteration}[/yellow]")

            # Run kiro-cli
            exit_code = client.run_chat(config.prompt)

            if exit_code != 0:
                console.print(f"[red]Kiro exited with code {exit_code}[/red]")

            # Only check for completion after minimum iterations reached
            if iteration >= config.min_iterations:
                session = get_latest_session(cwd)
                if session and session.check_completion_promise(
                    config.completion_promise
                ):
                    console.print(f"[green]Completed at iteration {iteration}![/green]")
                    cleanup()
                    sys.exit(0)
            else:
                console.print(
                    f"[dim]Iteration {iteration}/{config.min_iterations} "
                    f"(min not reached, skipping completion check)[/dim]"
                )

            # Check max iterations
            if config.max_iterations > 0 and iteration >= config.max_iterations:
                console.print(
                    f"[red]Max iterations ({config.max_iterations}) reached[/red]"
                )
                cleanup()
                sys.exit(0)

    except KeyboardInterrupt:
        console.print(f"\n[yellow]Interrupted at iteration {iteration}[/yellow]")
        cleanup()
        sys.exit(1)


def cleanup() -> None:
    """Remove state files."""
    STATE_FILE.unlink(missing_ok=True)
