"""Cyclopts CLI application for Ralph Wiggum."""

from cyclopts import App

from ralph_wiggum import __version__
from ralph_wiggum.commands.cancel import cancel_cmd
from ralph_wiggum.commands.init import init_cmd
from ralph_wiggum.commands.loop import loop_cmd

app = App(
    name="ralph",
    help="Ralph Wiggum iterative loop technique for Kiro CLI",
    version=__version__,
)

app.command(init_cmd, name="init")
app.command(loop_cmd, name="loop")
app.command(cancel_cmd, name="cancel")


def main() -> None:
    """Main entry point."""
    app()


if __name__ == "__main__":
    main()
