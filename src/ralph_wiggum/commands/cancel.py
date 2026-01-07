"""Cancel command - cancel an active Ralph loop."""

from pathlib import Path

from rich.console import Console

from ralph_wiggum.models.state import LoopState

console = Console()

STATE_FILE = Path(".kiro/ralph-loop.local.md")
SESSION_FILE = Path(".kiro/ralph-session.json")


def cancel_cmd() -> None:
    """Cancel an active Ralph loop.

    Removes the loop state file and session file, stopping
    the loop on its next iteration check.
    """
    if not STATE_FILE.exists():
        console.print("No active Ralph loop found.")
        return

    try:
        state = LoopState.from_markdown(STATE_FILE.read_text())
        iteration = state.iteration
    except Exception:
        iteration = "?"

    STATE_FILE.unlink(missing_ok=True)
    SESSION_FILE.unlink(missing_ok=True)

    console.print(f"Cancelled Ralph loop (was at iteration {iteration})")
