"""Init command - initialize Ralph Wiggum in current project."""

import json
from importlib import resources
from pathlib import Path

from rich.console import Console

console = Console()

KIRO_AGENTS_DIR = Path(".kiro/agents")
KIRO_STEERING_DIR = Path(".kiro/steering")


def get_data_file(filename: str) -> str:
    """Get contents of a data file from the package."""
    try:
        # Python 3.11+ style
        return resources.files("ralph_wiggum.data").joinpath(filename).read_text()
    except (TypeError, AttributeError):
        # Fallback for older Python
        with resources.open_text("ralph_wiggum.data", filename) as f:
            return f.read()


def init_cmd(
    force: bool = False,
) -> None:
    """Initialize Ralph Wiggum in the current project.

    Creates .kiro/agents/ralph-wiggum.json and .kiro/steering/ralph-context.md
    so you can use the Ralph agent with kiro-cli.

    Parameters
    ----------
    force
        Overwrite existing files if they exist.
    """
    agent_path = KIRO_AGENTS_DIR / "ralph-wiggum.json"
    steering_path = KIRO_STEERING_DIR / "ralph-context.md"

    # Check for existing files
    if not force:
        existing = []
        if agent_path.exists():
            existing.append(str(agent_path))
        if steering_path.exists():
            existing.append(str(steering_path))
        if existing:
            console.print("[red]Files already exist:[/red]")
            for f in existing:
                console.print(f"  - {f}")
            console.print("\nUse [bold]--force[/bold] to overwrite.")
            return

    # Create directories
    KIRO_AGENTS_DIR.mkdir(parents=True, exist_ok=True)
    KIRO_STEERING_DIR.mkdir(parents=True, exist_ok=True)

    # Load agent config (paths are already correct for .kiro/agents/ location)
    agent_config = json.loads(get_data_file("ralph-wiggum.json"))

    # Write agent config
    agent_path.write_text(json.dumps(agent_config, indent=2) + "\n")
    console.print(f"[green]Created[/green] {agent_path}")

    # Copy steering file
    steering_content = get_data_file("ralph-context.md")
    steering_path.write_text(steering_content)
    console.print(f"[green]Created[/green] {steering_path}")

    console.print()
    console.print("[bold green]Ralph Wiggum initialized![/bold green]")
    console.print()
    console.print("You can now use the Ralph agent with kiro-cli:")
    console.print("  [dim]kiro-cli chat --agent .kiro/agents/ralph-wiggum.json[/dim]")
    console.print()
    console.print("Or start a Ralph loop:")
    console.print(
        '  [dim]ralph loop "Your task" --max-iterations 20 --completion-promise "DONE"[/dim]'
    )
