"""Loop command - start a Ralph Wiggum iterative loop."""

from typing import Annotated

from cyclopts import Parameter
from rich.console import Console

from ralph_wiggum.core.loop_runner import run_loop
from ralph_wiggum.models.config import LoopConfig

console = Console()


def loop_cmd(
    prompt: Annotated[str, Parameter(help="Task prompt for the loop")],
    min_iterations: Annotated[
        int,
        Parameter(
            name=["--min-iterations", "-n"],
            help="Minimum iterations before checking completion",
        ),
    ] = 1,
    max_iterations: Annotated[
        int,
        Parameter(name=["--max-iterations", "-m"], help="Max iterations (0=unlimited)"),
    ] = 0,
    completion_promise: Annotated[
        str,
        Parameter(
            name=["--completion-promise", "-p"],
            help="Promise phrase to signal completion (default: COMPLETE)",
        ),
    ] = "COMPLETE",
    agent_name: Annotated[
        str | None,
        Parameter(name=["--agent", "-a"], help="Agent name (default: ralph-wiggum)"),
    ] = None,
) -> None:
    """Start a Ralph Wiggum iterative loop.

    The loop runs kiro-cli repeatedly with fresh sessions until:
    - Minimum iterations completed AND completion promise detected
    - Max iterations is reached
    - User interrupts with Ctrl+C

    Parameters
    ----------
    prompt
        Task description for the agent to work on.
    min_iterations
        Minimum iterations before checking for completion promise.
    max_iterations
        Maximum iterations before stopping (0=unlimited).
    completion_promise
        Phrase that signals task completion when wrapped in <promise> tags.
    agent_name
        Name of the Kiro agent to use (discovered from .kiro/agents/).

    Examples
    --------
    ralph loop "Build a REST API" --min-iterations 3 --max-iterations 20

    ralph loop "Fix the auth bug" -n 2 -m 10 -p "FIXED"
    """
    config = LoopConfig(
        prompt=prompt,
        min_iterations=min_iterations,
        max_iterations=max_iterations,
        completion_promise=completion_promise,
        agent_name=agent_name,
    )

    run_loop(config, console)
