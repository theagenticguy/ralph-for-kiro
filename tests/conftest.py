"""Pytest fixtures for Ralph Wiggum tests."""

import json
import sqlite3
import tempfile
from pathlib import Path

import pytest


@pytest.fixture
def sample_kiro_session_json() -> dict:
    """A sample Kiro session with a completion promise."""
    return {
        "conversation_id": "test-session-123",
        "next_message": None,
        "history": [
            {
                "user": {
                    "content": {"Prompt": {"prompt": "Build something"}},
                    "timestamp": "2026-01-07T12:00:00Z",
                },
                "assistant": {
                    "ToolUse": {
                        "message_id": "msg-1",
                        "content": "",
                        "tool_uses": [{"id": "tool-1", "name": "fs_read"}],
                    }
                },
            },
            {
                "user": {
                    "content": {"ToolUseResults": {"tool_use_results": []}},
                },
                "assistant": {
                    "Response": {
                        "message_id": "msg-2",
                        "content": "I have completed the task.\n\n<promise>TASK_COMPLETE</promise>",
                    }
                },
            },
        ],
    }


@pytest.fixture
def sample_session_no_promise() -> dict:
    """A sample session without a completion promise."""
    return {
        "conversation_id": "test-session-456",
        "history": [
            {
                "user": {"content": {"Prompt": {"prompt": "Do something"}}},
                "assistant": {
                    "Response": {
                        "message_id": "msg-1",
                        "content": "Working on it, not done yet.",
                    }
                },
            },
        ],
    }


@pytest.fixture
def temp_sqlite_db(sample_kiro_session_json: dict) -> Path:
    """Create a temporary SQLite database with test data."""
    with tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False) as f:
        db_path = Path(f.name)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create the conversations_v2 table
    cursor.execute("""
        CREATE TABLE conversations_v2 (
            key TEXT NOT NULL,
            conversation_id TEXT NOT NULL,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY (key, conversation_id)
        )
    """)

    # Insert test data
    cursor.execute(
        """
        INSERT INTO conversations_v2 (key, conversation_id, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            "/test/project",
            "test-session-123",
            json.dumps(sample_kiro_session_json),
            1767811253272,
            1767811253272,
        ),
    )

    conn.commit()
    conn.close()

    yield db_path

    # Cleanup
    db_path.unlink(missing_ok=True)
