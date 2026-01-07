"""Tests for session reader (SQLite queries)."""

import json
import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest

from ralph_wiggum.core import session_reader
from ralph_wiggum.core.session_reader import get_latest_session


class TestGetLatestSession:
    """Tests for get_latest_session function."""

    def test_read_session_from_sqlite(
        self, temp_sqlite_db: Path, sample_kiro_session_json: dict
    ):
        """Read session from SQLite database."""
        # Patch the DB path to use our temp database
        with patch.object(session_reader, "KIRO_DB_PATH", temp_sqlite_db):
            session = get_latest_session(Path("/test/project"))

        assert session is not None
        assert session.conversation_id == "test-session-123"
        assert len(session.history) == 2

    def test_check_promise_from_sqlite_session(self, temp_sqlite_db: Path):
        """Full integration: read session and check promise."""
        with patch.object(session_reader, "KIRO_DB_PATH", temp_sqlite_db):
            session = get_latest_session(Path("/test/project"))

        assert session is not None
        assert session.check_completion_promise("TASK_COMPLETE") is True

    def test_returns_none_for_unknown_directory(self, temp_sqlite_db: Path):
        """Return None when no session exists for directory."""
        with patch.object(session_reader, "KIRO_DB_PATH", temp_sqlite_db):
            session = get_latest_session(Path("/unknown/directory"))

        assert session is None

    def test_returns_none_when_db_missing(self, tmp_path: Path):
        """Return None when database file doesn't exist."""
        nonexistent_db = tmp_path / "nonexistent.sqlite3"
        with patch.object(session_reader, "KIRO_DB_PATH", nonexistent_db):
            session = get_latest_session(Path("/test/project"))

        assert session is None

    def test_returns_most_recent_session(self, tmp_path: Path):
        """When multiple sessions exist, return the most recent."""
        db_path = tmp_path / "test.sqlite3"
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

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

        # Insert older session (without promise)
        old_session = {
            "conversation_id": "old-session",
            "history": [
                {
                    "assistant": {
                        "Response": {"message_id": "msg", "content": "Working..."}
                    }
                }
            ],
        }
        cursor.execute(
            "INSERT INTO conversations_v2 VALUES (?, ?, ?, ?, ?)",
            ("/test", "old-session", json.dumps(old_session), 1000, 1000),
        )

        # Insert newer session (with promise)
        new_session = {
            "conversation_id": "new-session",
            "history": [
                {
                    "assistant": {
                        "Response": {
                            "message_id": "msg",
                            "content": "Done! <promise>COMPLETE</promise>",
                        }
                    }
                }
            ],
        }
        cursor.execute(
            "INSERT INTO conversations_v2 VALUES (?, ?, ?, ?, ?)",
            ("/test", "new-session", json.dumps(new_session), 2000, 2000),
        )

        conn.commit()
        conn.close()

        with patch.object(session_reader, "KIRO_DB_PATH", db_path):
            session = get_latest_session(Path("/test"))

        assert session is not None
        assert session.conversation_id == "new-session"
        assert session.check_completion_promise("COMPLETE") is True


class TestRealDatabaseIntegration:
    """Test with the real Kiro database (if available)."""

    @pytest.mark.skipif(
        not session_reader.KIRO_DB_PATH.exists(),
        reason="Kiro database not found - skipping real DB test",
    )
    def test_read_from_real_database(self):
        """Read from actual Kiro database (integration test)."""
        # Use the test-rg directory which should have sessions
        test_dir = Path("/home/lalsaado/projects/kiro-cli-ralph-wiggum/test-rg")

        session = get_latest_session(test_dir)

        # Just verify we can read something
        print("\n--- Real Database Test ---")
        print(f"Session found: {session is not None}")
        if session:
            print(f"Conversation ID: {session.conversation_id}")
            print(f"History turns: {len(session.history)}")
            last_text = session.get_last_assistant_text()
            if last_text:
                print(f"Last response preview: {last_text[:200]}...")
                print(
                    f"Contains TASK_COMPLETE promise: {session.check_completion_promise('TASK_COMPLETE')}"
                )
                print(
                    f"Contains COMPLETE promise: {session.check_completion_promise('COMPLETE')}"
                )
