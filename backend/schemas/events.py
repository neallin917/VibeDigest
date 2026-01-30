"""
SSE (Server-Sent Events) event schemas for real-time task streaming.

These Pydantic models define the structure of events sent from the backend
to connected clients via SSE. They ensure type safety and enable automatic
TypeScript type generation for the frontend.
"""

from datetime import datetime
from typing import Optional, Union, Literal
from pydantic import BaseModel, Field

from constants import OutputKind, TaskStatus


class TaskProgressEvent(BaseModel):
    """Progress update event during task processing."""

    event_type: Literal["progress"] = "progress"
    task_id: str = Field(..., description="The task ID being processed")
    status: TaskStatus = Field(..., description="Current task status")
    progress: int = Field(
        ...,
        ge=0,
        le=100,
        description="Progress percentage (0-100)"
    )
    stage: str = Field(
        ...,
        description="Current processing stage: check_cache, ingest, cognition, cleanup"
    )
    message: Optional[str] = Field(
        None,
        description="Human-readable progress message"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Event timestamp in UTC"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TaskOutputEvent(BaseModel):
    """Event emitted when a task output is ready or updated."""

    event_type: Literal["output"] = "output"
    task_id: str = Field(..., description="The task ID")
    output_id: str = Field(..., description="The output ID")
    output_kind: OutputKind = Field(..., description="Type of output")
    status: TaskStatus = Field(..., description="Output status")
    content: Optional[str] = Field(
        None,
        description="The output content (for small outputs)"
    )
    locale: Optional[str] = Field(
        None,
        description="Language/locale code (e.g., 'zh', 'en')"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Event timestamp in UTC"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TaskCompleteEvent(BaseModel):
    """Event emitted when task processing completes successfully."""

    event_type: Literal["complete"] = "complete"
    task_id: str = Field(..., description="The completed task ID")
    status: Literal[TaskStatus.COMPLETED] = TaskStatus.COMPLETED
    video_title: Optional[str] = Field(
        None,
        description="Final video title"
    )
    thumbnail_url: Optional[str] = Field(
        None,
        description="Video thumbnail URL"
    )
    duration: Optional[float] = Field(
        None,
        description="Video duration in seconds"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Event timestamp in UTC"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TaskErrorEvent(BaseModel):
    """Event emitted when task processing encounters an error."""

    event_type: Literal["error"] = "error"
    task_id: str = Field(..., description="The failed task ID")
    status: Literal[TaskStatus.ERROR] = TaskStatus.ERROR
    error: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(
        None,
        description="Machine-readable error code"
    )
    recoverable: bool = Field(
        default=False,
        description="Whether the error can be retried"
    )
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Event timestamp in UTC"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HeartbeatEvent(BaseModel):
    """Heartbeat event to keep SSE connection alive."""

    event_type: Literal["heartbeat"] = "heartbeat"
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        description="Heartbeat timestamp in UTC"
    )

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Union type for all possible SSE events
SSEEvent = Union[
    TaskProgressEvent,
    TaskOutputEvent,
    TaskCompleteEvent,
    TaskErrorEvent,
    HeartbeatEvent,
]
