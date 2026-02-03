"""Tests for Pydantic schemas."""

import pytest
from datetime import datetime
from pydantic import ValidationError

from schemas.events import (
    TaskProgressEvent,
    TaskOutputEvent,
    TaskCompleteEvent,
    TaskErrorEvent,
    HeartbeatEvent,
)
from schemas.api import (
    TaskCreateResponse,
    TaskStatusResponse,
    VideoPreviewResponse,
    TaskOutputResponse,
    RetryOutputResponse,
    ErrorResponse,
)
from constants import TaskStatus, OutputKind


class TestTaskProgressEvent:
    """Tests for TaskProgressEvent schema."""

    def test_valid_event(self):
        """Test creating a valid progress event."""
        event = TaskProgressEvent(
            task_id="task-123",
            status=TaskStatus.PROCESSING,
            progress=50,
            stage="cognition",
            message="Processing...",
        )
        assert event.event_type == "progress"
        assert event.task_id == "task-123"
        assert event.progress == 50
        assert event.timestamp is not None

    def test_progress_bounds(self):
        """Test progress percentage bounds."""
        # Valid bounds
        event_min = TaskProgressEvent(
            task_id="t1",
            status=TaskStatus.PROCESSING,
            progress=0,
            stage="test",
        )
        assert event_min.progress == 0

        event_max = TaskProgressEvent(
            task_id="t2",
            status=TaskStatus.PROCESSING,
            progress=100,
            stage="test",
        )
        assert event_max.progress == 100

    def test_invalid_progress_over_100(self):
        """Test that progress over 100 is invalid."""
        with pytest.raises(ValidationError):
            TaskProgressEvent(
                task_id="t1",
                status=TaskStatus.PROCESSING,
                progress=101,
                stage="test",
            )

    def test_invalid_progress_negative(self):
        """Test that negative progress is invalid."""
        with pytest.raises(ValidationError):
            TaskProgressEvent(
                task_id="t1",
                status=TaskStatus.PROCESSING,
                progress=-1,
                stage="test",
            )

    def test_optional_message(self):
        """Test that message is optional."""
        event = TaskProgressEvent(
            task_id="t1",
            status=TaskStatus.PROCESSING,
            progress=50,
            stage="test",
        )
        assert event.message is None

    def test_serialization(self):
        """Test JSON serialization."""
        event = TaskProgressEvent(
            task_id="t1",
            status=TaskStatus.PROCESSING,
            progress=75,
            stage="cleanup",
        )
        data = event.model_dump()
        assert data["event_type"] == "progress"
        assert data["progress"] == 75


class TestTaskOutputEvent:
    """Tests for TaskOutputEvent schema."""

    def test_valid_event(self):
        """Test creating a valid output event."""
        event = TaskOutputEvent(
            task_id="task-123",
            output_id="out-456",
            output_kind=OutputKind.SUMMARY,
            status=TaskStatus.COMPLETED,
            content='{"overview": "test"}',
            locale="zh",
        )
        assert event.event_type == "output"
        assert event.output_kind == OutputKind.SUMMARY

    def test_optional_fields(self):
        """Test optional fields."""
        event = TaskOutputEvent(
            task_id="t1",
            output_id="o1",
            output_kind=OutputKind.SCRIPT,
            status=TaskStatus.PROCESSING,
        )
        assert event.content is None
        assert event.locale is None


class TestTaskCompleteEvent:
    """Tests for TaskCompleteEvent schema."""

    def test_valid_event(self):
        """Test creating a valid complete event."""
        event = TaskCompleteEvent(
            task_id="task-123",
            video_title="Test Video",
            thumbnail_url="https://example.com/thumb.jpg",
            duration=120.5,
        )
        assert event.event_type == "complete"
        assert event.status == TaskStatus.COMPLETED
        assert event.duration == 120.5

    def test_status_is_always_completed(self):
        """Test that status is always COMPLETED."""
        event = TaskCompleteEvent(task_id="t1")
        assert event.status == TaskStatus.COMPLETED


class TestTaskErrorEvent:
    """Tests for TaskErrorEvent schema."""

    def test_valid_event(self):
        """Test creating a valid error event."""
        event = TaskErrorEvent(
            task_id="task-123",
            error="Something went wrong",
            error_code="TRANSCRIPTION_FAILED",
            recoverable=True,
        )
        assert event.event_type == "error"
        assert event.status == TaskStatus.ERROR
        assert event.recoverable is True

    def test_default_recoverable(self):
        """Test default recoverable is False."""
        event = TaskErrorEvent(
            task_id="t1",
            error="Error message",
        )
        assert event.recoverable is False


class TestHeartbeatEvent:
    """Tests for HeartbeatEvent schema."""

    def test_valid_event(self):
        """Test creating a valid heartbeat."""
        event = HeartbeatEvent()
        assert event.event_type == "heartbeat"
        assert isinstance(event.timestamp, datetime)


class TestTaskCreateResponse:
    """Tests for TaskCreateResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = TaskCreateResponse(
            task_id="task-123",
            message="Task started",
        )
        assert response.task_id == "task-123"


class TestTaskStatusResponse:
    """Tests for TaskStatusResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = TaskStatusResponse(
            id="task-123",
            video_url="https://youtube.com/watch?v=abc",
            status=TaskStatus.PROCESSING,
            progress=50,
            created_at=datetime.utcnow(),
        )
        assert response.id == "task-123"
        assert response.progress == 50

    def test_optional_fields(self):
        """Test optional fields."""
        response = TaskStatusResponse(
            id="t1",
            video_url="https://example.com/video",
            status=TaskStatus.PENDING,
            created_at=datetime.utcnow(),
        )
        assert response.video_title is None
        assert response.error is None
        assert response.duration is None


class TestVideoPreviewResponse:
    """Tests for VideoPreviewResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = VideoPreviewResponse(
            title="Test Video",
            thumbnail="https://example.com/thumb.jpg",
            duration=300.0,
            author="Test Author",
            url="https://youtube.com/watch?v=123",
        )
        assert response.title == "Test Video"
        assert response.duration == 300.0

    def test_defaults(self):
        """Test default values."""
        response = VideoPreviewResponse(
            title="Video",
            url="https://example.com",
        )
        assert response.thumbnail == ""
        assert response.duration == 0
        assert response.author == "Unknown"


class TestTaskOutputResponse:
    """Tests for TaskOutputResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = TaskOutputResponse(
            id="out-123",
            task_id="task-456",
            kind=OutputKind.SUMMARY,
            status=TaskStatus.COMPLETED,
            content='{"overview": "test"}',
            locale="en",
            progress=100,
            created_at=datetime.utcnow(),
        )
        assert response.kind == OutputKind.SUMMARY
        assert response.progress == 100


class TestRetryOutputResponse:
    """Tests for RetryOutputResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = RetryOutputResponse(
            message="Retry queued",
            output_id="out-123",
        )
        assert response.message == "Retry queued"


class TestErrorResponse:
    """Tests for ErrorResponse schema."""

    def test_valid_response(self):
        """Test creating a valid response."""
        response = ErrorResponse(
            detail="Something went wrong",
            error_code="INTERNAL_ERROR",
        )
        assert response.detail == "Something went wrong"
