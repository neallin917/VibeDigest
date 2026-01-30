import logging
import asyncio
import os
from fastapi import APIRouter, Depends, Form, HTTPException, BackgroundTasks, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from dependencies import get_current_user, get_db_client, get_video_processor
from db_client import DBClient
from services.video_processor import VideoProcessor
from utils.url import normalize_video_url
from services.background_tasks import run_pipeline, handle_retry_output
from services.event_bus import event_bus
from utils.sse import format_sse_event, SSEStream
from schemas.events import TaskProgressEvent, HeartbeatEvent
from constants import TaskStatus

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/preview-video")
async def preview_video(
    url: str = Form(...),
    user_id: str = Depends(get_current_user),
    video_processor: VideoProcessor = Depends(get_video_processor)
):
    """
    Get video metadata without full processing.
    Used by chat tools to preview video before creating tasks.
    """
    try:
        # Normalize URL
        logger.info(f"Preview video request received for URL: {url}")
        normalized_url = normalize_video_url(url)

        if not normalized_url:
            logger.warning(f"Invalid URL received: {url}")
            raise HTTPException(status_code=400, detail="Invalid video URL")

        # Extract metadata only (no download)
        info = await video_processor.extract_info_only(normalized_url)

        return {
            "title": info.get("title", "Unknown"),
            "thumbnail": info.get("thumbnail", ""),
            "duration": info.get("duration", 0),
            "author": info.get("author", "Unknown"),
            "url": normalized_url,
            "description": info.get("description", ""),
            "upload_date": info.get("upload_date"),
            "view_count": info.get("view_count"),
        }

    except Exception as e:
        logger.error(f"Preview video failed: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to preview video: {str(e)}"
        )

@router.post("/process-video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_url: str = Form(...),
    summary_language: str = Form(default="zh"),
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client)
):
    """
    Start a new video processing task (Optimized for low latency).
    1. Check Quota.
    2. Create Task.
    3. Offload all logic (cache check, output creation, processing) to background.
    """
    # Normalize URL if scheme is missing
    video_url = normalize_video_url(video_url)

    if not video_url:
        raise HTTPException(status_code=400, detail="Invalid video URL")

    dev_quota_bypass = os.getenv("DEV_AUTH_BYPASS", "").strip().lower() in {
        "1",
        "true",
        "t",
        "yes",
        "y",
        "on",
    }

    # 0. Check Quota / Credits
    if not dev_quota_bypass and not db.check_and_consume_quota(user_id):
        raise HTTPException(
            status_code=402,
            detail="Quota exceeded or insufficient credits. Please upgrade your plan.",
        )

    try:
        # 1. Create Task (Always create a new container)
        task = db.create_task(user_id=user_id, video_url=video_url)
        if not task:
            raise HTTPException(status_code=500, detail="Failed to create task")
        task_id = str(task["id"])

        # 1.1 Create Essential Placeholders (Synchronous)
        # This ensures UI has something to show immediately and satisfies integration tests.
        db.create_task_output(task_id, user_id, kind="script")
        db.create_task_output(
            task_id, user_id, kind="summary", locale=summary_language
        )
        db.create_task_output(
            task_id, user_id, kind="comprehension_brief", locale=summary_language
        )

        logger.info(
            f"Created task {task_id} for user {user_id}. Queuing background pipeline..."
        )

        # 2. Start Background Processing (pass user_id for output creation)
        background_tasks.add_task(
            run_pipeline, task_id, video_url, summary_language, user_id
        )

        return {"task_id": task_id, "message": "Task started"}

    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retry-output")
async def retry_output(
    background_tasks: BackgroundTasks,
    output_id: str = Form(...),
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client)
):
    """Retry a specific output."""
    # Reset status
    db.update_output_status(output_id, status="pending", progress=0, error="")

    # We need to know what task this belongs to, to re-run pipeline segments.
    # We will defer full retry logic to a background job wrapper that looks up the output
    background_tasks.add_task(handle_retry_output, output_id, user_id)

    return {"message": "Retry queued"}

@router.patch("/tasks/{task_id}")
async def update_task_title(
    task_id: str,
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client)
):
    """
    Update task details (title).
    Secure endpoint: checks ownership.
    """
    # 1. Verify Ownership
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Update
    new_title = payload.get("video_title")
    if new_title:
        db.update_task_status(task_id, video_title=new_title)

    return {"status": "success"}


@router.get("/tasks/{task_id}/stream")
async def stream_task_progress(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client),
):
    """
    SSE endpoint for real-time task progress updates.

    Streams events as the task processes:
    - progress: Processing progress updates (0-100%)
    - output: When a task output is ready
    - complete: When task finishes successfully
    - error: When task encounters an error
    - heartbeat: Keep-alive events (every 15s)

    Usage:
        const eventSource = new EventSource('/api/tasks/{task_id}/stream');
        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            console.log(`Progress: ${data.progress}%`);
        });
    """
    # 1. Verify task exists and user has access
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    async def event_generator():
        """Generate SSE events for the task."""
        stream = SSEStream(heartbeat_interval=15.0)
        queue = await event_bus.subscribe(task_id)

        try:
            # Send initial state event
            initial_event = TaskProgressEvent(
                task_id=task_id,
                status=TaskStatus(task.get("status", "pending")),
                progress=task.get("progress", 0),
                stage="init",
                message="Connected to task stream",
            )
            yield stream.event("init", initial_event)

            # Check if task is already completed/errored
            current_status = task.get("status", "pending")
            if current_status == TaskStatus.COMPLETED.value:
                yield stream.event("complete", {
                    "task_id": task_id,
                    "status": "completed",
                    "video_title": task.get("video_title"),
                    "thumbnail_url": task.get("thumbnail_url"),
                })
                return
            elif current_status == TaskStatus.ERROR.value:
                yield stream.event("error", {
                    "task_id": task_id,
                    "status": "error",
                    "error": task.get("error", "Unknown error"),
                })
                return

            # Stream events until task completes or errors
            while True:
                try:
                    # Wait for event with timeout (for heartbeat)
                    event = await asyncio.wait_for(
                        queue.get(),
                        timeout=30.0,
                    )

                    # Serialize and send the event
                    event_type = getattr(event, "event_type", "unknown")
                    yield stream.event(event_type, event)

                    # Check for terminal events
                    if event_type in ("complete", "error"):
                        logger.info(
                            f"Task {task_id} stream ending with {event_type}"
                        )
                        break

                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield stream.event("heartbeat", HeartbeatEvent())

                except asyncio.CancelledError:
                    logger.info(f"Task {task_id} stream cancelled by client")
                    break

        except Exception as e:
            logger.error(f"Error in task stream for {task_id}: {e}")
            yield stream.event("error", {
                "task_id": task_id,
                "error": str(e),
                "recoverable": True,
            })

        finally:
            # Clean up subscription
            await event_bus.unsubscribe(task_id, queue)
            logger.debug(f"Unsubscribed from task {task_id} stream")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",  # CORS for EventSource
        },
    )


@router.get("/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: DBClient = Depends(get_db_client),
):
    """
    Get current task status (polling fallback for SSE).

    For clients that don't support SSE, this endpoint provides
    the same information via traditional polling.
    """
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": task["id"],
        "video_url": task.get("video_url"),
        "video_title": task.get("video_title"),
        "thumbnail_url": task.get("thumbnail_url"),
        "status": task.get("status", "pending"),
        "progress": task.get("progress", 0),
        "error": task.get("error"),
        "created_at": task.get("created_at"),
        "updated_at": task.get("updated_at"),
    }
