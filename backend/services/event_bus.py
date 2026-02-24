"""
Task Event Bus for SSE streaming.

Provides a pub/sub system for distributing task progress events
to connected SSE clients. This enables real-time streaming of task updates
without polling.

Supports two backends:
    - In-memory (TaskEventBus): Default fallback, single-process only
    - Redis Pub/Sub (RedisEventBus): Distributed, multi-process support

Architecture:
    Workflow/Services --> event_bus.publish() --> [Redis or Queues] --> SSE Endpoints --> Clients

Thread Safety:
    The event bus uses asyncio locks to ensure thread-safe operations.
    Each subscriber gets their own queue to prevent blocking.
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, Optional, Set
from collections import defaultdict
from datetime import datetime

from schemas.events import (
    TaskProgressEvent,
    TaskOutputEvent,
    TaskCompleteEvent,
    TaskErrorEvent,
    HeartbeatEvent,
    SSEEvent,
)
from constants import TaskStatus, OutputKind

logger = logging.getLogger(__name__)

# Map event_type strings to their Pydantic model classes for deserialization
_EVENT_TYPE_MAP: Dict[str, type] = {
    "progress": TaskProgressEvent,
    "output": TaskOutputEvent,
    "complete": TaskCompleteEvent,
    "error": TaskErrorEvent,
    "heartbeat": HeartbeatEvent,
}


class TaskEventBus:
    """
    In-memory event bus for task progress streaming.

    Supports multiple subscribers per task with independent queues.
    Implements automatic cleanup of stale subscriptions.
    """

    def __init__(self, max_queue_size: int = 100):
        """
        Initialize the event bus.

        Args:
            max_queue_size: Maximum events to buffer per subscriber queue.
                           Older events are dropped if queue is full.
        """
        self._subscribers: Dict[str, Set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._max_queue_size = max_queue_size
        self._stats = {
            "total_published": 0,
            "total_subscribers": 0,
            "dropped_events": 0,
        }

    async def subscribe(self, task_id: str) -> asyncio.Queue:
        """
        Subscribe to events for a specific task.

        Args:
            task_id: The task ID to subscribe to

        Returns:
            An asyncio.Queue that will receive events for this task
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=self._max_queue_size)
        async with self._lock:
            self._subscribers[task_id].add(queue)
            self._stats["total_subscribers"] += 1
            logger.debug(
                f"New subscriber for task {task_id}. "
                f"Total subscribers: {len(self._subscribers[task_id])}"
            )
        return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """
        Unsubscribe from task events.

        Args:
            task_id: The task ID to unsubscribe from
            queue: The queue returned from subscribe()
        """
        async with self._lock:
            if task_id in self._subscribers:
                self._subscribers[task_id].discard(queue)
                if not self._subscribers[task_id]:
                    del self._subscribers[task_id]
                logger.debug(f"Unsubscribed from task {task_id}")

    async def publish(self, task_id: str, event: SSEEvent) -> int:
        """
        Publish an event to all subscribers of a task.

        Args:
            task_id: The task ID to publish to
            event: The event to publish (must be a Pydantic SSE event model)

        Returns:
            Number of subscribers that received the event
        """
        async with self._lock:
            queues = self._subscribers.get(task_id, set()).copy()

        if not queues:
            logger.debug(f"No subscribers for task {task_id}, event dropped")
            return 0

        delivered = 0
        for queue in queues:
            try:
                queue.put_nowait(event)
                delivered += 1
            except asyncio.QueueFull:
                # Drop oldest event and try again
                try:
                    queue.get_nowait()  # Remove oldest
                    queue.put_nowait(event)
                    delivered += 1
                    self._stats["dropped_events"] += 1
                except (asyncio.QueueEmpty, asyncio.QueueFull):
                    self._stats["dropped_events"] += 1
                    logger.warning(
                        f"Failed to deliver event to subscriber for task {task_id}"
                    )

        self._stats["total_published"] += 1
        return delivered

    async def publish_progress(
        self,
        task_id: str,
        progress: int,
        stage: str,
        message: Optional[str] = None,
        status: TaskStatus = TaskStatus.PROCESSING,
    ) -> int:
        """
        Convenience method to publish a progress event.

        Args:
            task_id: The task ID
            progress: Progress percentage (0-100)
            stage: Current processing stage
            message: Optional human-readable message
            status: Task status (default: PROCESSING)

        Returns:
            Number of subscribers that received the event
        """
        event = TaskProgressEvent(
            task_id=task_id,
            status=status,
            progress=progress,
            stage=stage,
            message=message,
        )
        return await self.publish(task_id, event)

    async def publish_output(
        self,
        task_id: str,
        output_id: str,
        output_kind: OutputKind,
        status: TaskStatus,
        content: Optional[str] = None,
        locale: Optional[str] = None,
    ) -> int:
        """
        Convenience method to publish an output event.

        Args:
            task_id: The task ID
            output_id: The output ID
            output_kind: Type of output
            status: Output status
            content: Optional output content
            locale: Optional locale code

        Returns:
            Number of subscribers that received the event
        """
        event = TaskOutputEvent(
            task_id=task_id,
            output_id=output_id,
            output_kind=output_kind,
            status=status,
            content=content,
            locale=locale,
        )
        return await self.publish(task_id, event)

    async def publish_complete(
        self,
        task_id: str,
        video_title: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        duration: Optional[float] = None,
    ) -> int:
        """
        Convenience method to publish a completion event.

        Args:
            task_id: The completed task ID
            video_title: Final video title
            thumbnail_url: Video thumbnail URL
            duration: Video duration in seconds

        Returns:
            Number of subscribers that received the event
        """
        event = TaskCompleteEvent(
            task_id=task_id,
            video_title=video_title,
            thumbnail_url=thumbnail_url,
            duration=duration,
        )
        return await self.publish(task_id, event)

    async def publish_error(
        self,
        task_id: str,
        error: str,
        error_code: Optional[str] = None,
        recoverable: bool = False,
    ) -> int:
        """
        Convenience method to publish an error event.

        Args:
            task_id: The failed task ID
            error: Error message
            error_code: Machine-readable error code
            recoverable: Whether the error can be retried

        Returns:
            Number of subscribers that received the event
        """
        event = TaskErrorEvent(
            task_id=task_id,
            error=error,
            error_code=error_code,
            recoverable=recoverable,
        )
        return await self.publish(task_id, event)

    def get_subscriber_count(self, task_id: str) -> int:
        """Get the number of active subscribers for a task."""
        return len(self._subscribers.get(task_id, set()))

    def get_stats(self) -> Dict[str, Any]:
        """Get event bus statistics."""
        return {
            **self._stats,
            "active_tasks": len(self._subscribers),
            "active_queues": sum(
                len(queues) for queues in self._subscribers.values()
            ),
        }

    async def cleanup_task(self, task_id: str) -> None:
        """
        Clean up all subscriptions for a task.

        Should be called when a task is completed or after a timeout.
        """
        async with self._lock:
            if task_id in self._subscribers:
                del self._subscribers[task_id]
                logger.debug(f"Cleaned up subscriptions for task {task_id}")


class RedisEventBus(TaskEventBus):
    """
    Redis-backed event bus for distributed task progress streaming.

    Publishes events to Redis Pub/Sub channels (task:{task_id}) so that
    multiple backend processes can share event streams. Local subscribers
    still receive events via asyncio.Queue, but events are forwarded
    from Redis listener tasks rather than published directly.
    """

    def __init__(self, redis_url: str, max_queue_size: int = 100):
        """
        Initialize the Redis event bus.

        Args:
            redis_url: Redis connection URL (e.g. redis://localhost:6379)
            max_queue_size: Maximum events to buffer per subscriber queue.
        """
        super().__init__(max_queue_size=max_queue_size)
        self._redis_url = redis_url
        self._redis = None
        self._listener_tasks: Dict[str, asyncio.Task] = {}

    def _channel_name(self, task_id: str) -> str:
        """Return the Redis channel name for a task."""
        return f"task:{task_id}"

    async def _get_redis(self):
        """Lazily create and return the Redis connection."""
        if self._redis is None:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(
                self._redis_url,
                decode_responses=True,
            )
        return self._redis

    def _serialize_event(self, event: SSEEvent) -> str:
        """Serialize an SSEEvent to a JSON string for Redis."""
        return event.model_dump_json()

    def _deserialize_event(self, data: str) -> SSEEvent:
        """Deserialize a JSON string from Redis back to an SSEEvent."""
        raw = json.loads(data)
        event_type = raw.get("event_type")
        model_cls = _EVENT_TYPE_MAP.get(event_type)
        if model_cls is None:
            raise ValueError(f"Unknown event_type: {event_type}")
        return model_cls.model_validate(raw)

    async def _listener(self, task_id: str) -> None:
        """
        Background task that listens to a Redis channel and forwards
        messages to all local subscriber queues for the given task_id.
        """
        try:
            redis_conn = await self._get_redis()
            pubsub = redis_conn.pubsub()
            channel = self._channel_name(task_id)
            await pubsub.subscribe(channel)
            logger.debug(f"Redis listener started for channel {channel}")

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    event = self._deserialize_event(message["data"])
                except Exception:
                    logger.exception(
                        f"Failed to deserialize event from Redis channel {channel}"
                    )
                    continue

                # Deliver to all local subscriber queues
                async with self._lock:
                    queues = self._subscribers.get(task_id, set()).copy()

                for queue in queues:
                    try:
                        queue.put_nowait(event)
                    except asyncio.QueueFull:
                        try:
                            queue.get_nowait()
                            queue.put_nowait(event)
                            self._stats["dropped_events"] += 1
                        except (asyncio.QueueEmpty, asyncio.QueueFull):
                            self._stats["dropped_events"] += 1
                            logger.warning(
                                f"Failed to deliver Redis event to subscriber "
                                f"for task {task_id}"
                            )
        except asyncio.CancelledError:
            logger.debug(f"Redis listener cancelled for task {task_id}")
        except Exception:
            logger.exception(f"Redis listener failed for task {task_id}")
        finally:
            try:
                if pubsub:
                    await pubsub.unsubscribe(self._channel_name(task_id))
                    await pubsub.close()
            except Exception:
                pass

    async def subscribe(self, task_id: str) -> asyncio.Queue:
        """
        Subscribe to events for a specific task.

        Starts a Redis listener for the task channel if one isn't already
        running.

        Args:
            task_id: The task ID to subscribe to

        Returns:
            An asyncio.Queue that will receive events for this task
        """
        queue = await super().subscribe(task_id)

        # Start a Redis listener if this is the first local subscriber
        if task_id not in self._listener_tasks or self._listener_tasks[task_id].done():
            self._listener_tasks[task_id] = asyncio.create_task(
                self._listener(task_id),
                name=f"redis-listener-{task_id}",
            )
            logger.debug(f"Started Redis listener task for {task_id}")

        return queue

    async def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """
        Unsubscribe from task events.

        Cancels the Redis listener if this was the last local subscriber.
        """
        await super().unsubscribe(task_id, queue)

        # Cancel the listener if no more local subscribers
        async with self._lock:
            remaining = len(self._subscribers.get(task_id, set()))

        if remaining == 0 and task_id in self._listener_tasks:
            task = self._listener_tasks.pop(task_id, None)
            if task and not task.done():
                task.cancel()
                logger.debug(f"Cancelled Redis listener for task {task_id}")

    async def publish(self, task_id: str, event: SSEEvent) -> int:
        """
        Publish an event via Redis Pub/Sub.

        The event is serialized and sent to the Redis channel. All processes
        with active listeners for this task will receive and forward the event
        to their local subscriber queues.

        Falls back to in-memory publish if Redis is unavailable.

        Args:
            task_id: The task ID to publish to
            event: The event to publish

        Returns:
            Number of Redis subscribers that received the message
        """
        try:
            redis_conn = await self._get_redis()
            channel = self._channel_name(task_id)
            data = self._serialize_event(event)
            receivers = await redis_conn.publish(channel, data)
            self._stats["total_published"] += 1
            return receivers
        except Exception:
            logger.warning(
                f"Redis publish failed for task {task_id}, "
                f"falling back to in-memory delivery",
                exc_info=True,
            )
            return await super().publish(task_id, event)

    async def cleanup_task(self, task_id: str) -> None:
        """
        Clean up all subscriptions and the Redis listener for a task.
        """
        # Cancel the listener first
        task = self._listener_tasks.pop(task_id, None)
        if task and not task.done():
            task.cancel()

        await super().cleanup_task(task_id)

    async def close(self) -> None:
        """
        Shut down all Redis listeners and close the Redis connection.
        """
        for task_id, task in list(self._listener_tasks.items()):
            if not task.done():
                task.cancel()
        self._listener_tasks.clear()

        if self._redis is not None:
            await self._redis.close()
            self._redis = None
            logger.info("Redis event bus connection closed")


def create_event_bus() -> TaskEventBus:
    """
    Factory function that creates the appropriate event bus.

    Tries to create a RedisEventBus using the REDIS_URL environment variable.
    Falls back to the in-memory TaskEventBus if Redis is unavailable or
    the redis package is not installed.

    Returns:
        A TaskEventBus instance (either Redis-backed or in-memory)
    """
    redis_url = os.environ.get("REDIS_URL")
    if redis_url:
        try:
            import redis.asyncio  # noqa: F401

            logger.info(f"Creating Redis event bus (url={redis_url})")
            return RedisEventBus(redis_url=redis_url)
        except ImportError:
            logger.warning(
                "redis package not installed, falling back to in-memory event bus. "
                "Install with: pip install redis"
            )
        except Exception:
            logger.warning(
                "Failed to create Redis event bus, falling back to in-memory",
                exc_info=True,
            )
    else:
        logger.info("REDIS_URL not set, using in-memory event bus")

    return TaskEventBus()


# Global singleton instance
event_bus = create_event_bus()


# Convenience function for direct import
async def publish_task_event(task_id: str, event: SSEEvent) -> int:
    """
    Publish an event to the global event bus.

    Args:
        task_id: The task ID
        event: The SSE event to publish

    Returns:
        Number of subscribers that received the event
    """
    return await event_bus.publish(task_id, event)
