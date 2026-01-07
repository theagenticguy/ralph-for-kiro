"""Tests for session model and promise checking."""



from ralph_wiggum.models.session import HistoryTurn, KiroSession


class TestHistoryTurn:
    """Tests for HistoryTurn model."""

    def test_get_assistant_text_response(self):
        """Extract text from Response type."""
        turn = HistoryTurn(
            user={"content": {"Prompt": {"prompt": "test"}}},
            assistant={
                "Response": {
                    "message_id": "msg-1",
                    "content": "Hello, this is a response.",
                }
            },
        )
        assert turn.get_assistant_text() == "Hello, this is a response."

    def test_get_assistant_text_tool_use(self):
        """ToolUse type should return None (no text content)."""
        turn = HistoryTurn(
            assistant={
                "ToolUse": {
                    "message_id": "msg-1",
                    "content": "",
                    "tool_uses": [],
                }
            }
        )
        assert turn.get_assistant_text() is None

    def test_get_assistant_text_no_assistant(self):
        """No assistant field should return None."""
        turn = HistoryTurn(user={"content": {}})
        assert turn.get_assistant_text() is None


class TestKiroSession:
    """Tests for KiroSession model."""

    def test_parse_session_json(self, sample_kiro_session_json: dict):
        """Parse a complete session JSON."""
        session = KiroSession.model_validate(sample_kiro_session_json)
        assert session.conversation_id == "test-session-123"
        assert len(session.history) == 2

    def test_get_last_assistant_text(self, sample_kiro_session_json: dict):
        """Get the last assistant response text."""
        session = KiroSession.model_validate(sample_kiro_session_json)
        text = session.get_last_assistant_text()
        assert text is not None
        assert "completed the task" in text
        assert "<promise>TASK_COMPLETE</promise>" in text

    def test_check_completion_promise_found(self, sample_kiro_session_json: dict):
        """Detect completion promise in session."""
        session = KiroSession.model_validate(sample_kiro_session_json)
        assert session.check_completion_promise("TASK_COMPLETE") is True

    def test_check_completion_promise_not_found(self, sample_kiro_session_json: dict):
        """Return False when promise not present."""
        session = KiroSession.model_validate(sample_kiro_session_json)
        assert session.check_completion_promise("DIFFERENT_PROMISE") is False

    def test_check_completion_promise_case_insensitive(self):
        """Promise matching should be case insensitive."""
        session = KiroSession(
            conversation_id="test",
            history=[
                HistoryTurn(
                    assistant={
                        "Response": {
                            "message_id": "msg-1",
                            "content": "Done! <promise>task_complete</promise>",
                        }
                    }
                )
            ],
        )
        assert session.check_completion_promise("TASK_COMPLETE") is True
        assert session.check_completion_promise("Task_Complete") is True

    def test_check_completion_promise_with_whitespace(self):
        """Promise matching should handle whitespace."""
        session = KiroSession(
            conversation_id="test",
            history=[
                HistoryTurn(
                    assistant={
                        "Response": {
                            "message_id": "msg-1",
                            "content": "Done! <promise>  COMPLETE  </promise>",
                        }
                    }
                )
            ],
        )
        assert session.check_completion_promise("COMPLETE") is True

    def test_check_completion_promise_empty_session(self):
        """Empty session should return False."""
        session = KiroSession(conversation_id="test", history=[])
        assert session.check_completion_promise("COMPLETE") is False

    def test_check_completion_promise_no_response(
        self, sample_session_no_promise: dict
    ):
        """Session without promise should return False."""
        session = KiroSession.model_validate(sample_session_no_promise)
        assert session.check_completion_promise("TASK_COMPLETE") is False


class TestRealWorldSession:
    """Test with real-world Kiro session data."""

    def test_parse_real_session_structure(self):
        """Test parsing a session that matches real Kiro output."""
        real_session = {
            "conversation_id": "3fcce2be-1dba-467e-812d-a980755faac6",
            "next_message": None,
            "history": [
                {
                    "user": {
                        "additional_context": "",
                        "env_context": {
                            "env_state": {
                                "operating_system": "linux",
                                "current_working_directory": "/test",
                            }
                        },
                        "content": {"Prompt": {"prompt": "Build an API"}},
                        "timestamp": "2026-01-07T12:40:49.990123239-06:00",
                    },
                    "assistant": {
                        "ToolUse": {
                            "message_id": "42f4235e-f948-4c4a-8318-603aae394770",
                            "content": "",
                            "tool_uses": [
                                {"id": "tooluse_S4oj", "name": "fs_read", "args": {}}
                            ],
                        }
                    },
                    "request_metadata": {"request_id": "22d8131c"},
                },
                {
                    "user": {
                        "content": {
                            "ToolUseResults": {
                                "tool_use_results": [
                                    {"tool_use_id": "tooluse_S4oj", "status": "Success"}
                                ]
                            }
                        }
                    },
                    "assistant": {
                        "Response": {
                            "message_id": "bfab80dc-57b3-46cd-8ebd-5225f7909a84",
                            "content": "The API is complete!\n\n<promise>DONE</promise>",
                        }
                    },
                },
            ],
        }

        session = KiroSession.model_validate(real_session)
        assert session.conversation_id == "3fcce2be-1dba-467e-812d-a980755faac6"
        assert len(session.history) == 2
        assert session.check_completion_promise("DONE") is True
        assert (
            session.get_last_assistant_text()
            == "The API is complete!\n\n<promise>DONE</promise>"
        )
