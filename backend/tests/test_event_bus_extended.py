"""Extended tests for services/event_bus.py — targeting uncovered branches."""

import asyncio
import json
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

from services.event_bus import (
    TaskEventBus,
    RedisEventBus,
    create_event_bus,
    publish_task_event,
)
from schemas.events import (
    TaskProgressEvent,
    TaskOutputEvent,
    TaskErrorEvent,
    TaskCompleteEvent,
    HeartbeatEvent,
)
from constants import TaskStatus, OutputKind


@pytest.fixture
def bus():
    return TaskEventBus(max_queue_size=10)


# ---------------------------------------------------------------------------
# publish_output convenience method
# ---------------------------------------------------------------------------

class TestPublishOutput:
    async def test_publish_output_delivers_event(self, bus):
        task_id = "output-test-001"
        queue = await bus.subscribe(task_id)

        delivered = await bus.publish_output(
            task_id=task_id,
            output_id="out-123",
            output_kind=OutputKind.SUMMARY,
            status=TaskStatus.COMPLETED,
            content="Summary content here",
            locale="en",
        )

        assert delivered == 1
        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert isinstance(received, TaskOutputEvent)
        assert received.output_id == "out-123"
        assert received.locale == "en"
        assert received.content == "Summary content here"

        await bus.unsubscribe(task_id, queue)

    async def test_publish_output_no_content(self, bus):
        task_id = "output-test-002"
        queue = await bus.subscribe(task_id)

        delivered = await bus.publish_output(
            task_id=task_id,
            output_id="out-456",
            output_kind=OutputKind.SUMMARY,
            status=TaskStatus.PROCESSING,
        )

        assert delivered == 1
        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert received.content is None
        assert received.locale is None

        await bus.unsubscribe(task_id, queue)


# ---------------------------------------------------------------------------
# publish_error convenience method
# ---------------------------------------------------------------------------

class TestPublishError:
    async def test_publish_error_delivers_event(self, bus):
        task_id = "error-test-001"
        queue = await bus.subscribe(task_id)

        delivered = await bus.publish_error(
            task_id=task_id,
            error="Something went wrong",
            error_code="E_TIMEOUT",
            recoverable=True,
        )

        assert delivered == 1
        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert isinstance(received, TaskErrorEvent)
        assert received.error == "Something went wrong"
        assert received.error_code == "E_TIMEOUT"
        assert received.recoverable is True

        await bus.unsubscribe(task_id, queue)

    async def test_publish_error_defaults(self, bus):
        task_id = "error-test-002"
        queue = await bus.subscribe(task_id)

        await bus.publish_error(task_id=task_id, error="Basic error")

        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert received.error_code is None
        assert received.recoverable is False

        await bus.unsubscribe(task_id, queue)


# ---------------------------------------------------------------------------
# RedisEventBus — serialization / deserialization / channel name
# (No actual Redis connection required)
# ---------------------------------------------------------------------------

class TestRedisEventBusHelpers:
    @pytest.fixture
    def redis_bus(self):
        return RedisEventBus(redis_url="redis://localhost:6379")

    def test_channel_name(self, redis_bus):
        assert redis_bus._channel_name("task-abc") == "task:task-abc"

    def test_serialize_progress_event(self, redis_bus):
        event = TaskProgressEvent(
            task_id="t1",
            status=TaskStatus.PROCESSING,
            progress=50,
            stage="cognition",
        )
        serialized = redis_bus._serialize_event(event)
        data = json.loads(serialized)
        assert data["event_type"] == "progress"
        assert data["task_id"] == "t1"
        assert data["progress"] == 50

    def test_serialize_complete_event(self, redis_bus):
        event = TaskCompleteEvent(task_id="t2", video_title="My Video")
        serialized = redis_bus._serialize_event(event)
        data = json.loads(serialized)
        assert data["event_type"] == "complete"
        assert data["video_title"] == "My Video"

    def test_deserialize_progress_event(self, redis_bus):
        event = TaskProgressEvent(
            task_id="t3",
            status=TaskStatus.PROCESSING,
            progress=75,
            stage="ingest",
        )
        serialized = redis_bus._serialize_event(event)
        deserialized = redis_bus._deserialize_event(serialized)
        assert isinstance(deserialized, TaskProgressEvent)
        assert deserialized.task_id == "t3"
        assert deserialized.progress == 75

    def test_deserialize_error_event(self, redis_bus):
        event = TaskErrorEvent(task_id="t4", error="Oops")
        serialized = redis_bus._serialize_event(event)
        deserialized = redis_bus._deserialize_event(serialized)
        assert isinstance(deserialized, TaskErrorEvent)
        assert deserialized.error == "Oops"

    def test_deserialize_heartbeat_event(self, redis_bus):
        event = HeartbeatEvent()
        serialized = redis_bus._serialize_event(event)
        deserialized = redis_bus._deserialize_event(serialized)
        assert isinstance(deserialized, HeartbeatEvent)

    def test_deserialize_unknown_event_type_raises(self, redis_bus):
        data = json.dumps({"event_type": "nonexistent_type"})
        with pytest.raises(ValueError, match="Unknown event_type"):
            redis_bus._deserialize_event(data)


# ---------------------------------------------------------------------------
# create_event_bus factory
# ---------------------------------------------------------------------------

class TestCreateEventBus:
    def test_no_redis_url_creates_in_memory_bus(self, monkeypatch):
        monkeypatch.delenv("REDIS_URL", raising=False)
        bus = create_event_bus()
        assert isinstance(bus, TaskEventBus)
        # Should NOT be a RedisEventBus subclass
        assert type(bus) is TaskEventBus

    def test_with_redis_url_but_import_error_falls_back(self, monkeypatch):
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
        with patch.dict("sys.modules", {"redis": None, "redis.asyncio": None}):
            # Simulate ImportError by patching the import inside create_event_bus
            with patch("builtins.__import__", side_effect=_import_error_for_redis):
                bus = create_event_bus()
        # Falls back to in-memory
        assert isinstance(bus, TaskEventBus)

    def test_with_redis_url_creates_redis_bus(self, monkeypatch):
        monkeypatch.setenv("REDIS_URL", "redis://localhost:6379")
        # Mock redis.asyncio so import succeeds
        mock_redis_module = MagicMock()
        with patch.dict("sys.modules", {"redis": mock_redis_module, "redis.asyncio": mock_redis_module}):
            bus = create_event_bus()
        assert isinstance(bus, RedisEventBus)
        assert bus._redis_url == "redis://localhost:6379"


def _import_error_for_redis(name, *args, **kwargs):
    """Side-effect function: raises ImportError for redis imports, passes otherwise."""
    if "redis" in name:
        raise ImportError(f"No module named {name!r}")
    return original_import(name, *args, **kwargs)


import builtins
original_import = builtins.__import__


# ---------------------------------------------------------------------------
# publish_task_event convenience function
# ---------------------------------------------------------------------------

class TestPublishTaskEvent:
    async def test_publish_task_event_reaches_subscriber(self):
        from services.event_bus import event_bus

        task_id = "global-bus-test-xyz"
        queue = await event_bus.subscribe(task_id)

        event = TaskProgressEvent(
            task_id=task_id,
            status=TaskStatus.PROCESSING,
            progress=10,
            stage="test",
        )
        delivered = await publish_task_event(task_id, event)
        assert delivered >= 1

        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert received.task_id == task_id

        await event_bus.unsubscribe(task_id, queue)
