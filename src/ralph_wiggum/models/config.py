"""CLI configuration models."""

from typing import Annotated

from pydantic import BaseModel, Field, field_validator


class LoopConfig(BaseModel):
    """Configuration for a Ralph loop."""

    prompt: str = Field(..., min_length=1, description="Task prompt")
    min_iterations: Annotated[int, Field(ge=1)] = (
        1  # Minimum before checking completion
    )
    max_iterations: Annotated[int, Field(ge=0)] = 0  # 0 = unlimited
    completion_promise: str = "COMPLETE"
    agent_name: str | None = None  # Agent name (Kiro discovers from .kiro/agents/)

    @field_validator("completion_promise")
    @classmethod
    def validate_promise(cls, v: str) -> str:
        """Validate that completion promise is not empty."""
        if len(v.strip()) == 0:
            raise ValueError("Completion promise cannot be empty")
        return v
