"""Loop state model with markdown serialization."""

from datetime import datetime, timezone
from typing import Self

import yaml
from pydantic import BaseModel, Field


class LoopState(BaseModel):
    """State persisted in .kiro/ralph-loop.local.md."""

    active: bool = True
    iteration: int = Field(ge=1, default=1)
    min_iterations: int = Field(ge=1, default=1)
    max_iterations: int = Field(ge=0, default=0)
    completion_promise: str = "COMPLETE"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    prompt: str

    def to_markdown(self) -> str:
        """Serialize to markdown with YAML frontmatter."""
        frontmatter = self.model_dump(exclude={"prompt"}, mode="json")
        yaml_str = yaml.dump(frontmatter, default_flow_style=False, sort_keys=False)
        return f"---\n{yaml_str}---\n\n{self.prompt}"

    @classmethod
    def from_markdown(cls, content: str) -> Self:
        """Parse from markdown with YAML frontmatter."""
        parts = content.split("---", 2)
        if len(parts) < 3:
            raise ValueError("Invalid state file format: missing YAML frontmatter")
        frontmatter = yaml.safe_load(parts[1])
        if frontmatter is None:
            raise ValueError("Invalid state file format: empty frontmatter")
        frontmatter["prompt"] = parts[2].strip()
        return cls.model_validate(frontmatter)
