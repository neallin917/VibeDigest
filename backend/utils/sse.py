"""
Server-Sent Events (SSE) utility functions.

Provides helpers for formatting SSE events and managing SSE streams
according to the SSE specification (https://html.spec.whatwg.org/multipage/server-sent-events.html).
"""

import json
import asyncio
from datetime import datetime
from typing import Any, AsyncGenerator, Optional, Union
from pydantic import BaseModel


def format_sse_event(
    data: Any,
    event: Optional[str] = None,
    id: Optional[str] = None,
    retry: Optional[int] = None,
) -> str:
    """
    Format data as an SSE event string.

    Args:
        data: The event data (will be JSON-encoded if not a string)
        event: Optional event type name
        id: Optional event ID for client reconnection
        retry: Optional retry interval in milliseconds

    Returns:
        Formatted SSE event string ready to be sent to client
    """
    lines = []

    if id is not None:
        lines.append(f"id: {id}")

    if event is not None:
        lines.append(f"event: {event}")

    if retry is not None:
        lines.append(f"retry: {retry}")

    # Serialize data
    if isinstance(data, BaseModel):
        data_str = data.model_dump_json()
    elif isinstance(data, (dict, list)):
        data_str = json.dumps(data, default=str, ensure_ascii=False)
    elif isinstance(data, str):
        data_str = data
    else:
        data_str = json.dumps(data, default=str)

    # SSE requires each line of data to be prefixed with "data: "
    for line in data_str.split("\n"):
        lines.append(f"data: {line}")

    # Events are terminated by a blank line
    lines.append("")
    lines.append("")

    return "\n".join(lines)


async def sse_event(
    event_type: str,
    data: Any,
    id: Optional[str] = None,
) -> str:
    """
    Async helper to format an SSE event.

    Args:
        event_type: The event type (e.g., "progress", "output", "complete")
        data: Event payload (Pydantic model, dict, or string)
        id: Optional event ID

    Returns:
        Formatted SSE event string
    """
    return format_sse_event(data=data, event=event_type, id=id)


async def heartbeat_generator(
    interval: float = 15.0,
    max_heartbeats: Optional[int] = None,
) -> AsyncGenerator[str, None]:
    """
    Generate periodic heartbeat events to keep SSE connection alive.

    Args:
        interval: Seconds between heartbeats (default: 15)
        max_heartbeats: Maximum number of heartbeats to send (None for infinite)

    Yields:
        Formatted heartbeat SSE events
    """
    count = 0
    while max_heartbeats is None or count < max_heartbeats:
        await asyncio.sleep(interval)
        yield format_sse_event(
            data={"timestamp": datetime.utcnow().isoformat()},
            event="heartbeat",
        )
        count += 1


class SSEStream:
    """
    Helper class for managing an SSE stream with automatic heartbeats.

    Usage:
        async def event_generator():
            stream = SSEStream(heartbeat_interval=15.0)

            # Send initial event
            yield stream.event("init", {"status": "connected"})

            # Merge heartbeats with your event source
            async for event in stream.merge_with_heartbeat(your_event_source()):
                yield event
    """

    def __init__(
        self,
        heartbeat_interval: float = 15.0,
        retry_ms: int = 3000,
    ):
        """
        Initialize SSE stream helper.

        Args:
            heartbeat_interval: Seconds between heartbeat events
            retry_ms: Reconnection retry interval sent to client
        """
        self.heartbeat_interval = heartbeat_interval
        self.retry_ms = retry_ms
        self._event_counter = 0

    def event(
        self,
        event_type: str,
        data: Any,
        id: Optional[str] = None,
    ) -> str:
        """Format a single SSE event with optional auto-incrementing ID."""
        if id is None:
            self._event_counter += 1
            id = str(self._event_counter)
        return format_sse_event(data=data, event=event_type, id=id)

    def retry_event(self) -> str:
        """Send retry interval to client."""
        return f"retry: {self.retry_ms}\n\n"

    async def merge_with_heartbeat(
        self,
        event_source: AsyncGenerator[str, None],
        timeout: float = 30.0,
    ) -> AsyncGenerator[str, None]:
        """
        Merge an event source with periodic heartbeats.

        If no events arrive within timeout, sends a heartbeat to keep connection alive.

        Args:
            event_source: Async generator yielding SSE event strings
            timeout: Seconds to wait before sending heartbeat

        Yields:
            SSE event strings (either from source or heartbeat)
        """
        import asyncio

        event_iter = event_source.__aiter__()

        while True:
            try:
                # Wait for next event with timeout
                event = await asyncio.wait_for(
                    event_iter.__anext__(),
                    timeout=timeout,
                )
                yield event
            except asyncio.TimeoutError:
                # No event received, send heartbeat
                yield format_sse_event(
                    data={"timestamp": datetime.utcnow().isoformat()},
                    event="heartbeat",
                )
            except StopAsyncIteration:
                # Event source exhausted
                break
