"""Tests for SSE utility functions."""

import pytest
import asyncio
import json
from datetime import datetime
from pydantic import BaseModel

from utils.sse import (
    format_sse_event,
    sse_event,
    heartbeat_generator,
    SSEStream,
)


class SampleModel(BaseModel):
    """Sample Pydantic model for testing."""
    name: str
    value: int


class TestFormatSSEEvent:
    """Tests for format_sse_event function."""

    def test_basic_data_dict(self):
        """Test formatting with dict data."""
        result = format_sse_event({"message": "hello"})
        assert 'data: {"message": "hello"}' in result
        assert result.endswith("\n\n")

    def test_with_event_type(self):
        """Test formatting with event type."""
        result = format_sse_event({"status": "ok"}, event="progress")
        assert "event: progress" in result
        assert 'data: {"status": "ok"}' in result

    def test_with_id(self):
        """Test formatting with event ID."""
        result = format_sse_event({"data": 1}, id="123")
        assert "id: 123" in result
        assert 'data: {"data": 1}' in result

    def test_with_retry(self):
        """Test formatting with retry interval."""
        result = format_sse_event({"data": 1}, retry=3000)
        assert "retry: 3000" in result

    def test_with_all_options(self):
        """Test formatting with all options."""
        result = format_sse_event(
            {"status": "complete"},
            event="done",
            id="456",
            retry=5000,
        )
        assert "id: 456" in result
        assert "event: done" in result
        assert "retry: 5000" in result
        assert 'data: {"status": "complete"}' in result

    def test_pydantic_model(self):
        """Test formatting Pydantic model."""
        model = SampleModel(name="test", value=42)
        result = format_sse_event(model)
        data = json.loads(result.split("data: ")[1].split("\n")[0])
        assert data["name"] == "test"
        assert data["value"] == 42

    def test_string_data(self):
        """Test formatting string data."""
        result = format_sse_event("simple string")
        assert "data: simple string" in result

    def test_multiline_data(self):
        """Test formatting multiline data."""
        result = format_sse_event("line1\nline2\nline3")
        assert "data: line1" in result
        assert "data: line2" in result
        assert "data: line3" in result

    def test_list_data(self):
        """Test formatting list data."""
        result = format_sse_event([1, 2, 3])
        assert "data: [1, 2, 3]" in result

    def test_datetime_serialization(self):
        """Test that datetime is serialized correctly."""
        dt = datetime(2024, 1, 15, 12, 30, 0)
        result = format_sse_event({"timestamp": dt})
        assert "2024-01-15" in result

    def test_empty_dict(self):
        """Test formatting empty dict."""
        result = format_sse_event({})
        assert "data: {}" in result

    def test_none_event_type(self):
        """Test that None event type is not included."""
        result = format_sse_event({"data": 1}, event=None)
        assert "event:" not in result


@pytest.mark.asyncio
class TestSSEEventAsync:
    """Tests for async sse_event helper."""

    async def test_basic_event(self):
        """Test async event formatting."""
        result = await sse_event("progress", {"percent": 50})
        assert "event: progress" in result
        assert "percent" in result

    async def test_with_id(self):
        """Test async event with ID."""
        result = await sse_event("update", {"data": 1}, id="evt-1")
        assert "id: evt-1" in result


@pytest.mark.asyncio
class TestHeartbeatGenerator:
    """Tests for heartbeat_generator."""

    async def test_generates_heartbeats(self):
        """Test that heartbeats are generated."""
        gen = heartbeat_generator(interval=0.01, max_heartbeats=3)
        heartbeats = []
        async for hb in gen:
            heartbeats.append(hb)

        assert len(heartbeats) == 3
        for hb in heartbeats:
            assert "event: heartbeat" in hb
            assert "timestamp" in hb

    async def test_infinite_generator_can_be_cancelled(self):
        """Test that infinite generator can be cancelled."""
        gen = heartbeat_generator(interval=0.01, max_heartbeats=None)
        count = 0
        async for _ in gen:
            count += 1
            if count >= 2:
                break
        assert count == 2


class TestSSEStream:
    """Tests for SSEStream helper class."""

    def test_event_formatting(self):
        """Test stream event formatting."""
        stream = SSEStream(heartbeat_interval=15.0)
        result = stream.event("test", {"value": 123})

        assert "event: test" in result
        assert "value" in result
        assert "id: 1" in result

    def test_auto_increment_id(self):
        """Test that event IDs auto-increment."""
        stream = SSEStream()
        e1 = stream.event("test", {"n": 1})
        e2 = stream.event("test", {"n": 2})
        e3 = stream.event("test", {"n": 3})

        assert "id: 1" in e1
        assert "id: 2" in e2
        assert "id: 3" in e3

    def test_custom_id(self):
        """Test custom event ID."""
        stream = SSEStream()
        result = stream.event("test", {"data": 1}, id="custom-id")
        assert "id: custom-id" in result

    def test_retry_event(self):
        """Test retry event generation."""
        stream = SSEStream(retry_ms=5000)
        result = stream.retry_event()
        assert "retry: 5000" in result

    @pytest.mark.asyncio
    async def test_merge_with_heartbeat_timeout(self):
        """Test heartbeat injection on timeout."""
        stream = SSEStream()

        async def slow_source():
            await asyncio.sleep(0.5)  # Longer than timeout
            yield stream.event("data", {"value": 1})

        received = []
        async for event in stream.merge_with_heartbeat(
            slow_source(),
            timeout=0.05,  # Short timeout
        ):
            received.append(event)
            if len(received) >= 2:
                break

        # Should have received heartbeat before data
        assert any("heartbeat" in e for e in received)

    @pytest.mark.asyncio
    async def test_merge_with_heartbeat_fast_source(self):
        """Test that fast source events pass through."""
        stream = SSEStream()

        async def fast_source():
            yield stream.event("data", {"n": 1})
            yield stream.event("data", {"n": 2})

        received = []
        async for event in stream.merge_with_heartbeat(
            fast_source(),
            timeout=10.0,  # Long timeout
        ):
            received.append(event)

        assert len(received) == 2
        assert all("event: data" in e for e in received)

    @pytest.mark.asyncio
    async def test_merge_handles_source_completion(self):
        """Test that merge completes when source is exhausted."""
        stream = SSEStream()

        async def finite_source():
            yield stream.event("a", {})
            yield stream.event("b", {})

        events = []
        async for event in stream.merge_with_heartbeat(finite_source(), timeout=1.0):
            events.append(event)

        assert len(events) == 2
