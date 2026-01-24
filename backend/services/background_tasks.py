import asyncio
import json
import logging
from typing import Any
from contextlib import nullcontext, contextmanager

from config import settings
from db_client import DBClient
from summarizer import Summarizer
from workflow import app as workflow_app
from transcriber import format_markdown_from_raw_segments
from dependencies import get_db_client, get_summarizer

logger = logging.getLogger(__name__)

# Langfuse V3 setup
try:
    from langfuse import get_client as get_langfuse_client, propagate_attributes
except ImportError:
    def get_langfuse_client(*args: Any, **kwargs: Any) -> Any:
        return None

    @contextmanager
    def propagate_attributes(**kwargs):
        yield

# Concurrency Control
MAX_CONCURRENT_JOBS = 4
processing_limiter = asyncio.Semaphore(MAX_CONCURRENT_JOBS)

async def run_pipeline(task_id: str, video_url: str, summary_lang: str, user_id: str):
    """
    Main orchestration pipeline.
    Wrapped in a Semaphore to limit concurrency.
    Uses Langfuse propagate_attributes for automatic trace context propagation.
    """
    db_client = get_db_client()

    async with processing_limiter:
        logger.info(
            f"Task {task_id} acquiring execution slot... (Active: {MAX_CONCURRENT_JOBS - processing_limiter._value})"
        )

        langfuse = get_langfuse_client()
        observation_ctx = (
            langfuse.start_as_current_observation(
                as_type="span",
                name="Video Processing Pipeline",
                input={"video_url": video_url, "summary_lang": summary_lang},
            )
            if langfuse
            else nullcontext()
        )

        with observation_ctx:
            with propagate_attributes(
                session_id=str(task_id), user_id=str(user_id), tags=["pipeline"]
            ):
                logger.info(
                    f"[Pipeline Start] Task={task_id}, URL={video_url}, Lang={summary_lang}"
                )

                try:
                    # Initialize input state
                    initial_state = {
                        "task_id": task_id,
                        "user_id": user_id,
                        "video_url": video_url,
                        "summary_lang": summary_lang,
                        "errors": [],
                        "cache_hit": False,
                        "is_youtube": False,
                    }

                    # Invoke Graph
                    await workflow_app.ainvoke(initial_state)

                except Exception as e:
                    logger.error(f"Pipeline crashed: {e}")
                    db_client.update_task_status(task_id, status="error", error=str(e))


async def handle_retry_output(output_id: str, user_id: str):
    """
    Handle logic for retrying a single output.
    Does NOT re-download video. Relies on existing Script output content if available.
    """
    db_client = get_db_client()
    summarizer = get_summarizer()

    try:
        out = db_client.get_output(output_id)
        if not out:
            return
        if out.get("user_id") != user_id:
            db_client.update_output_status(
                output_id, status="error", error="Not authorized"
            )
            return

        task_id = out.get("task_id")
        kind = out.get("kind")
        locale = out.get("locale")
        if not task_id or not kind:
            db_client.update_output_status(
                output_id, status="error", error="Invalid output"
            )
            return

        outputs = db_client.get_task_outputs(task_id)
        script_output = next((o for o in outputs if o.get("kind") == "script"), None)
        script_raw_output = next(
            (o for o in outputs if o.get("kind") == "script_raw"), None
        )

        if kind == "script":
            # Prefer re-formatting from persisted raw segments.
            if not script_raw_output or not script_raw_output.get("content"):
                db_client.update_output_status(
                    output_id,
                    status="error",
                    error="No raw transcript segments found; please create a new task to re-transcribe.",
                )
                return
            try:
                payload = json.loads(script_raw_output["content"])
                raw_segments = payload.get("segments", [])
                detected_language = payload.get("language", "unknown")
                md_with_ts = format_markdown_from_raw_segments(
                    raw_segments, detected_language=detected_language
                )
                clean = await summarizer.optimize_transcript(md_with_ts)
                db_client.update_output_status(
                    output_id, status="completed", progress=100, content=clean, error=""
                )
                return
            except Exception as e:
                db_client.update_output_status(
                    output_id, status="error", error=f"Reformat failed: {str(e)}"
                )
                return

        # For summary/translation, rely on existing script content.
        if not script_output or not script_output.get("content"):
            db_client.update_output_status(
                output_id, status="error", error="Missing script content; cannot retry."
            )
            return

        script_text = script_output["content"]
        # Keep the existing optimization step consistent.
        try:
            script_text = await summarizer.optimize_transcript(script_text)
        except Exception:
            pass

        if kind == "summary" or kind == "summary_source":
            task = db_client.get_task(task_id)
            video_title = (task or {}).get("video_title") or ""
            try:
                db_client.update_output_status(
                    output_id, status="processing", progress=30, error=""
                )
                # Always regenerate source-language summary first (stable, anchored).
                script_raw_json = None
                transcript_language = "unknown"
                try:
                    if script_raw_output and script_raw_output.get("content"):
                        script_raw_json = script_raw_output.get("content")
                        payload = json.loads(script_raw_json or "{}")
                        transcript_language = payload.get("language") or "unknown"
                except Exception:
                    script_raw_json = script_raw_json

                source_summary_json = (
                    await summarizer.summarize_in_language_with_anchors(
                        script_text,
                        summary_language=transcript_language,
                        video_title=video_title,
                        script_raw_json=script_raw_json,
                    )
                )

                # Ensure summary_source output exists (old tasks may not have it).
                summary_source_out = next(
                    (o for o in outputs if o.get("kind") == "summary_source"), None
                )
                if not summary_source_out:
                    try:
                        summary_source_out = db_client.create_task_output(
                            task_id, user_id, kind="summary_source"
                        )
                        # Refresh outputs list for downstream lookups
                        outputs = db_client.get_task_outputs(task_id)
                    except Exception as e:
                        logger.warning(
                            f"Failed to create summary_source output for task={task_id}: {e}"
                        )

                if summary_source_out:
                    db_client.update_output_status(
                        summary_source_out["id"],
                        status="completed",
                        progress=100,
                        content=source_summary_json,
                        error="",
                    )

                # Now fulfill the requested output.
                if kind == "summary_source":
                    db_client.update_output_status(
                        output_id,
                        status="completed",
                        progress=100,
                        content=source_summary_json,
                        error="",
                    )
                    return

                # kind == "summary": translate to requested locale if needed, preserving anchors.
                requested_lang = locale or transcript_language or "zh"
                if str(requested_lang).lower() != str(transcript_language).lower():
                    summary_json = await summarizer.translate_summary_json(
                        source_summary_json, target_language=requested_lang
                    )
                else:
                    summary_json = source_summary_json

                db_client.update_output_status(
                    output_id,
                    status="completed",
                    progress=100,
                    content=summary_json,
                    error="",
                )
            except Exception as e:
                db_client.update_output_status(output_id, status="error", error=str(e))
            return

        db_client.update_output_status(
            output_id, status="error", error=f"Retry not supported for kind: {kind}"
        )

    except Exception as e:
        db_client.update_output_status(output_id, status="error", error=str(e))
