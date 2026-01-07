"""Kiro session parsing models."""

import re
from typing import Any

from pydantic import BaseModel, ConfigDict


class AssistantResponse(BaseModel):
    """An assistant Response message."""

    model_config = ConfigDict(extra="ignore")

    message_id: str
    content: str


class AssistantToolUse(BaseModel):
    """An assistant ToolUse message."""

    model_config = ConfigDict(extra="ignore")

    message_id: str
    content: str = ""


class HistoryTurn(BaseModel):
    """A turn in the conversation history."""

    model_config = ConfigDict(extra="ignore")

    user: dict[str, Any] | None = None
    assistant: dict[str, Any] | None = None

    def get_assistant_text(self) -> str | None:
        """Extract text from assistant Response if present."""
        if not self.assistant:
            return None

        # Check for Response type
        if "Response" in self.assistant:
            return self.assistant["Response"].get("content", "")

        return None


class KiroSession(BaseModel):
    """Parsed Kiro session from SQLite."""

    model_config = ConfigDict(extra="ignore")

    conversation_id: str = ""
    history: list[HistoryTurn] = []

    def get_last_assistant_text(self) -> str | None:
        """Get the text content of the last assistant Response."""
        for turn in reversed(self.history):
            text = turn.get_assistant_text()
            if text:
                return text
        return None

    def check_completion_promise(self, promise: str) -> bool:
        """Check if the last assistant response contains the completion promise."""
        text = self.get_last_assistant_text()
        if not text:
            return False

        # Match <promise>PHRASE</promise> with flexible whitespace
        pattern = rf"<promise>\s*{re.escape(promise)}\s*</promise>"
        return bool(re.search(pattern, text, re.IGNORECASE))
