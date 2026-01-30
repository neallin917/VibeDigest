"""Tests for the SSE event bus."""

import asyncio
import pytest
from services.event_bus import TaskEventBus, event_bus
from schemas.events import TaskProgressEvent, TaskCompleteEvent
from constants import TaskStatus


@pytest.fixture
def bus():
    """Create a fresh event bus for each test."""
    return TaskEventBus(max_queue_size=10)


@pytest.mark.asyncio
async def test_subscribe_unsubscribe(bus):
    """Test basic subscribe/unsubscribe functionality."""
    task_id = "test-task-123"

    # Subscribe
    queue = await bus.subscribe(task_id)
    assert bus.get_subscriber_count(task_id) == 1

    # Unsubscribe
    await bus.unsubscribe(task_id, queue)
    assert bus.get_subscriber_count(task_id) == 0


@pytest.mark.asyncio
async def test_publish_to_subscriber(bus):
    """Test publishing events to subscribers."""
    task_id = "test-task-456"

    # Subscribe
    queue = await bus.subscribe(task_id)

    # Publish event
    event = TaskProgressEvent(
        task_id=task_id,
        status=TaskStatus.PROCESSING,
        progress=50,
        stage="test",
        message="Testing...",
    )
    delivered = await bus.publish(task_id, event)

    assert delivered == 1

    # Verify event was received
    received = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert received.task_id == task_id
    assert received.progress == 50
    assert received.stage == "test"

    await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_publish_to_no_subscribers(bus):
    """Test publishing when no subscribers exist."""
    task_id = "no-subscribers"

    event = TaskProgressEvent(
        task_id=task_id,
        status=TaskStatus.PROCESSING,
        progress=0,
        stage="test",
    )
    delivered = await bus.publish(task_id, event)

    assert delivered == 0


@pytest.mark.asyncio
async def test_multiple_subscribers(bus):
    """Test publishing to multiple subscribers."""
    task_id = "multi-sub-task"

    # Create multiple subscribers
    queues = [await bus.subscribe(task_id) for _ in range(3)]
    assert bus.get_subscriber_count(task_id) == 3

    # Publish event
    event = TaskProgressEvent(
        task_id=task_id,
        status=TaskStatus.PROCESSING,
        progress=75,
        stage="test",
    )
    delivered = await bus.publish(task_id, event)

    assert delivered == 3

    # Verify all received
    for queue in queues:
        received = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert received.progress == 75

    # Cleanup
    for queue in queues:
        await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_publish_progress_convenience(bus):
    """Test the publish_progress convenience method."""
    task_id = "progress-test"
    queue = await bus.subscribe(task_id)

    delivered = await bus.publish_progress(
        task_id=task_id,
        progress=42,
        stage="cognition",
        message="Analyzing content...",
    )

    assert delivered == 1

    received = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert isinstance(received, TaskProgressEvent)
    assert received.progress == 42
    assert received.stage == "cognition"
    assert received.message == "Analyzing content..."

    await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_publish_complete_convenience(bus):
    """Test the publish_complete convenience method."""
    task_id = "complete-test"
    queue = await bus.subscribe(task_id)

    delivered = await bus.publish_complete(
        task_id=task_id,
        video_title="Test Video",
        thumbnail_url="https://example.com/thumb.jpg",
        duration=120.5,
    )

    assert delivered == 1

    received = await asyncio.wait_for(queue.get(), timeout=1.0)
    assert isinstance(received, TaskCompleteEvent)
    assert received.video_title == "Test Video"
    assert received.duration == 120.5

    await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_queue_overflow_handling(bus):
    """Test that queue overflow is handled gracefully."""
    task_id = "overflow-test"
    queue = await bus.subscribe(task_id)

    # Fill the queue beyond capacity
    for i in range(15):  # Queue size is 10
        await bus.publish_progress(
            task_id=task_id,
            progress=i,
            stage="test",
        )

    # Should still have events (oldest dropped)
    stats = bus.get_stats()
    assert stats["dropped_events"] > 0

    await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_cleanup_task(bus):
    """Test cleaning up all subscriptions for a task."""
    task_id = "cleanup-test"

    # Create multiple subscribers
    queues = [await bus.subscribe(task_id) for _ in range(3)]
    assert bus.get_subscriber_count(task_id) == 3

    # Cleanup
    await bus.cleanup_task(task_id)
    assert bus.get_subscriber_count(task_id) == 0


@pytest.mark.asyncio
async def test_stats_tracking(bus):
    """Test statistics tracking."""
    task_id = "stats-test"
    queue = await bus.subscribe(task_id)

    initial_stats = bus.get_stats()
    assert initial_stats["total_subscribers"] >= 1

    await bus.publish_progress(task_id=task_id, progress=50, stage="test")
    await bus.publish_progress(task_id=task_id, progress=100, stage="test")

    final_stats = bus.get_stats()
    assert final_stats["total_published"] >= 2

    await bus.unsubscribe(task_id, queue)


@pytest.mark.asyncio
async def test_global_event_bus_singleton():
    """Test that the global event_bus is a singleton."""
    from services.event_bus import event_bus as bus1
    from services.event_bus import event_bus as bus2

    assert bus1 is bus2
