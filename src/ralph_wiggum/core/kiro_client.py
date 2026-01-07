"""Subprocess wrapper for kiro-cli."""

import subprocess
from pathlib import Path

# Default agent name (Kiro discovers it from .kiro/agents/)
DEFAULT_AGENT_NAME = "ralph-wiggum"
LOCAL_AGENT_PATH = Path(".kiro/agents/ralph-wiggum.json")


class KiroClient:
    """Wrapper for kiro-cli subprocess calls."""

    def __init__(self, agent_name: str | None = None) -> None:
        """Initialize the Kiro client.

        Parameters
        ----------
        agent_name
            Name of the agent to use. Kiro discovers agents from .kiro/agents/.
            If None, uses "ralph-wiggum" (after verifying it exists).
        """
        self.agent_name = agent_name or self._default_agent_name()

    def _default_agent_name(self) -> str:
        """Get default agent name, verifying it exists."""
        if LOCAL_AGENT_PATH.exists():
            return DEFAULT_AGENT_NAME
        raise FileNotFoundError(
            f"Agent config not found at {LOCAL_AGENT_PATH}\n"
            "Run 'ralph init' first to initialize Ralph Wiggum in this project."
        )

    def run_chat(self, prompt: str) -> int:
        """Run a kiro-cli chat session.

        Parameters
        ----------
        prompt
            The prompt to send to kiro-cli.

        Returns
        -------
        int
            Exit code from kiro-cli.
        """
        cmd = [
            "kiro-cli",
            "chat",
            "--agent",
            self.agent_name,
            "--no-interactive",
            "--trust-all-tools",
        ]

        result = subprocess.run(
            cmd,
            input=prompt,
            text=True,
            capture_output=False,  # Show output in real-time
        )
        return result.returncode

    def save_session(self, path: Path) -> bool:
        """Save current session to a file.

        Parameters
        ----------
        path
            Path to save the session JSON to.

        Returns
        -------
        bool
            True if save was successful.
        """
        result = subprocess.run(
            ["kiro-cli", "chat", "save", str(path), "--force"],
            capture_output=True,
        )
        return result.returncode == 0
