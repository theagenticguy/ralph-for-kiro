"""Read Kiro sessions from SQLite database."""

import json
import sqlite3
from pathlib import Path

from ralph_wiggum.models.session import KiroSession

# Kiro CLI stores sessions in XDG data home
KIRO_DATA_DIR = Path.home() / ".local" / "share" / "kiro-cli"
KIRO_DB_PATH = KIRO_DATA_DIR / "data.sqlite3"


def get_latest_session(cwd: Path | None = None) -> KiroSession | None:
    """Get the most recent session for a directory.

    Parameters
    ----------
    cwd
        Working directory to get session for.
        Defaults to current working directory.

    Returns
    -------
    KiroSession | None
        The most recent session, or None if not found.
    """
    if cwd is None:
        cwd = Path.cwd()

    cwd_str = str(cwd.resolve())

    if not KIRO_DB_PATH.exists():
        return None

    try:
        conn = sqlite3.connect(KIRO_DB_PATH)
        cursor = conn.cursor()

        # Get the most recent session for this directory
        cursor.execute(
            """
            SELECT value FROM conversations_v2
            WHERE key = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (cwd_str,),
        )

        row = cursor.fetchone()
        conn.close()

        if not row:
            return None

        session_json = row[0]
        return KiroSession.model_validate_json(session_json)

    except (sqlite3.Error, json.JSONDecodeError) as e:
        # Log error but don't crash
        print(f"Warning: Could not read session: {e}")
        return None
