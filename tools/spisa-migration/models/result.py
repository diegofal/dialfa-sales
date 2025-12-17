"""Migration result models."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List


@dataclass
class EntityMigrationResult:
    """Result for a single entity migration."""
    entity_name: str
    migrated_count: int = 0
    failed_count: int = 0
    errors: List[str] = field(default_factory=list)
    duration: float = 0.0  # seconds
    
    @property
    def success(self) -> bool:
        return self.failed_count == 0 and not self.errors


@dataclass
class ValidationResult:
    """Result of data validation."""
    is_valid: bool = True
    issues: List[str] = field(default_factory=list)


@dataclass
class MigrationResult:
    """Overall migration result."""
    start_time: datetime
    end_time: datetime = None
    success: bool = False
    entities: List[EntityMigrationResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    @property
    def duration(self) -> float:
        """Duration in seconds."""
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0

