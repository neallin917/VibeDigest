"""
Task Event Bus for SSE streaming.

Provides an in-memory pub/sub system for distributing task progress events
to connected SSE clients. This enables real-time streaming of task updates
without polling.

Architecture:
    Workflow/Services --> event_bus.publish() --> [Queues] --> SSE Endpoints --> Clients

Thread Safety:
    The event bus uses asyncio locks to ensure thread-safe operations.
    Each subscriber gets their own queue to prevent blocking.
"""

import asyncio
import logging
from typing import Any, Dict, Optional, Set
from collections import defaultdict
from datetime import datetime

from schemas.events import (
    TaskProgressEvent,
    TaskOutputEvent,
    TaskCompleteEvent,
    TaskErrorEvent,
    SSEEvent,
)
from constants import TaskStatus, OutputKind

logger = logging.getLogger(__name__)


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


# Global singleton instance
event_bus = TaskEventBus()


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
