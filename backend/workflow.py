import json
import logging
import os
import asyncio
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any, Annotated
import operator
from urllib.parse import urlparse

from langgraph.graph import StateGraph, END

# Import existing instances/classes
from config import settings
from db_client import DBClient
from constants import OutputKind, TaskStatus
from services.supadata_client import SupadataClient
from services.summarizer import Summarizer
from services.comprehension import ComprehensionAgent
from services.transcriber import Transcriber
from services.video_processor import VideoProcessor
from utils.url import normalize_video_url

# Setup logger
logger = logging.getLogger(__name__)

# Initialize singletons
video_processor = VideoProcessor()
transcriber = Transcriber()
summarizer = Summarizer()
comprehension_agent = ComprehensionAgent()
db_client = DBClient()
supadata_client = SupadataClient()

# --- State Definition ---


class VideoProcessingState(TypedDict):
    # Inputs
    task_id: str
    user_id: str
    video_url: str
    summary_lang: str

    # Metadata
    video_title: str
    thumbnail_url: str
    author: str
    duration: float

    # Intermediate Artifacts
    audio_path: Optional[str]
    direct_audio_url: Optional[str]
    transcript_text: Optional[str]  # Optimized/Clean
    transcript_raw: Optional[str]  # JSON with segments
    transcript_lang: str

    classification_result: Optional[Dict]
    source_summary_json: Optional[str]
    final_summary_json: Optional[str]
    comprehension_brief_json: Optional[str]

    # Processing Control
    cache_hit: bool
    is_youtube: bool

    # Status
    # Use operator.add to append errors instead of overwriting them
    errors: Annotated[List[str], operator.add]
    transcript_source: Optional[str]  # "supadata", "vtt", "whisper"
    ingest_error: Optional[str]


# --- Nodes ---


async def check_cache(state: VideoProcessingState) -> Dict:
    """Checks DB for existing completed tasks (deduplication)."""
    logger.info(f"Node: check_cache for {state['video_url']}")
    normalized_url = normalize_video_url(state["video_url"])
    updates = {
        "cache_hit": False,
        "errors": [],
        "is_youtube": "youtube.com" in normalized_url or "youtu.be" in normalized_url,
    }

    try:
        # Improved Cache Strategy: Look for ANY task with a valid script, not just fully completed ones.
        # This allows "Resumable Workflow" (e.g. reused transcript if summarization failed previously).
        existing_task = db_client.find_latest_task_with_valid_script(
            normalized_url
        ) or db_client.find_latest_task_with_valid_script(state["video_url"])

        if existing_task:
            logger.info(f"Cache hit (Script Found): using task {existing_task['id']}")
            updates["cache_hit"] = True
            updates["video_title"] = existing_task.get("video_title") or "Unknown"
            updates["thumbnail_url"] = existing_task.get("thumbnail_url")

            # Update current task metadata
            db_client.update_task_status(
                state["task_id"],
                video_title=updates["video_title"],
                thumbnail_url=updates["thumbnail_url"],
            )

            # Copy outputs
            existing_outputs = db_client.get_task_outputs(existing_task["id"])
            for out in existing_outputs:
                if out.get("status") != TaskStatus.COMPLETED:
                    continue

                k = out.get("kind")
                val = out.get("content")
                loc = out.get("locale")

                # Copy reusable outputs
                if k in [
                    OutputKind.SCRIPT,
                    OutputKind.SCRIPT_RAW,
                    OutputKind.SUMMARY_SOURCE,
                    OutputKind.AUDIO,
                ]:
                    try:
                        db_client.upsert_completed_task_output(
                            state["task_id"], state["user_id"], str(k), str(val), locale=loc
                        )
                        if k == OutputKind.SCRIPT:
                            updates["transcript_text"] = val
                        elif k == OutputKind.SCRIPT_RAW:
                            updates["transcript_raw"] = val
                        elif k == OutputKind.CLASSIFICATION:
                            updates["classification_result"] = (
                                json.loads(val) if val else None
                            )
                        elif k == OutputKind.SUMMARY_SOURCE:
                            updates["source_summary_json"] = val
                    except Exception as e:
                        logger.warning(f"Failed to copy output {k}: {e}")

                # Copy match summary
                if k == OutputKind.SUMMARY:
                    cached_locale = (loc or "zh").lower()
                    requested_locale = (state["summary_lang"] or "zh").lower()
                    if cached_locale == requested_locale:
                        db_client.upsert_completed_task_output(
                            state["task_id"], state["user_id"], str(k), str(val), locale=loc
                        )
                        updates["final_summary_json"] = val

            # Validate Integrity: If script is missing, treat as miss
            if not updates.get("transcript_text"):
                logger.info(
                    "Cache hit but script missing/incomplete. Treating as Cache Miss."
                )
                updates["cache_hit"] = False
                updates["transcript_text"] = None

    except Exception as e:
        logger.error(f"Error in check_cache: {e}")

    return updates


# --- Ingest Helpers ---


async def _ingest_supadata(video_url: str, task_id: str) -> Optional[Dict]:
    try:
        db_client.update_task_status(task_id, status=TaskStatus.PROCESSING, progress=15)
        md, raw, lang = await supadata_client.get_transcript_async(video_url)
        if md and raw:
            logger.info("Strategy 1 (Supadata): Success")
            return {
                "transcript_text": summarizer.fast_clean_transcript(md),
                "transcript_raw": raw,
                "transcript_lang": lang,
                "transcript_source": "supadata",
            }
    except Exception as e:
        logger.info(f"Strategy 1 (Supadata) skipped/failed: {e}")
    return None


async def _ingest_vtt(video_url: str, task_id: str) -> Optional[Dict]:
    try:
        db_client.update_task_status(task_id, status=TaskStatus.PROCESSING, progress=25)
        logger.info("Attempting Strategy 2 (Direct VTT)...")
        res = await video_processor.extract_captions(video_url)
        if res:
            md, raw, lang = res
            logger.info("Strategy 2 (Direct VTT): Success")
            return {
                "transcript_text": summarizer.fast_clean_transcript(md),
                "transcript_raw": raw,
                "transcript_lang": lang,
                "transcript_source": "vtt",
            }
    except Exception as e:
        logger.warning(f"Strategy 2 (Direct VTT) failed: {e}")
    return None


async def _ingest_whisper(state: VideoProcessingState) -> Optional[Dict]:
    task_id = state["task_id"]
    video_url = state["video_url"]

    try:
        db_client.update_task_status(task_id, status=TaskStatus.PROCESSING, progress=30)
        logger.info("Attempting Strategy 3 (Download + Whisper)...")

        # 1. Download
        TEMP_DIR = Path("temp")
        TEMP_DIR.mkdir(exist_ok=True)

        (
            audio_path,
            title,
            thumb,
            direct_audio_url,
            info,
        ) = await video_processor.download_and_convert(video_url, TEMP_DIR)

        updates = {
            "audio_path": audio_path,
            "video_title": title,
            "thumbnail_url": thumb,
            "direct_audio_url": direct_audio_url,
            "duration": info.get("duration"),
        }

        # 2. Transcribe
        db_client.update_task_status(task_id, status=TaskStatus.PROCESSING, progress=50)
        (
            script_text_with_timestamps,
            raw_json,
            detected_language,
        ) = await transcriber.transcribe_with_raw(audio_path)

        updates["transcript_raw"] = raw_json
        updates["transcript_lang"] = detected_language

        # 3. LLM Optimization
        db_client.update_task_status(task_id, status=TaskStatus.PROCESSING, progress=70)
        trace_meta = {
            "session_id": str(task_id),
            "user_id": str(state["user_id"]),
            "metadata": {"video_url": video_url, "source": "whisper"},
        }
        cleaned = await summarizer.optimize_transcript(
            script_text_with_timestamps, trace_metadata=trace_meta
        )

        updates["transcript_text"] = cleaned
        updates["transcript_source"] = "whisper"

        return updates

    except Exception as e:
        logger.error(f"Strategy 3 (Whisper) failed: {e}")
        return {"error": str(e)}  # Special key to indicate failure inside helper


async def ingest(state: VideoProcessingState) -> Dict:
    """Unified Ingest Node: URL -> Clean Transcript & Metadata."""
    logger.info(f"Node: ingest for {state['video_url']}")

    if state.get("transcript_text"):
        logger.info("Script already present (Cache Hit). Skipping ingest.")
        return {}

    updates: Dict[str, Any] = {
        "errors": [],
        "transcript_source": "unknown",
        "video_title": state.get("video_title") or "Unknown",
        "thumbnail_url": state.get("thumbnail_url"),
    }

    task_id = state["task_id"]
    user_id = state["user_id"]
    video_url = state["video_url"]
    is_youtube = state["is_youtube"]

    # --- Step 1: Initialize DB Outputs ---
    required_outputs = [
        OutputKind.SCRIPT,
        OutputKind.SCRIPT_RAW,
        OutputKind.SUMMARY_SOURCE,
        OutputKind.CLASSIFICATION,
    ]

    host = urlparse(video_url).hostname or ""
    if host.replace("www.", "").endswith(("xiaoyuzhoufm.com", "apple.com")):
        required_outputs.append(OutputKind.AUDIO)

    db_client.ensure_task_outputs(task_id, user_id, [str(k) for k in required_outputs])

    # --- Step 2: Metadata Extraction ---
    try:
        meta = await video_processor.extract_info_only(video_url)
        updates.update(
            {
                "video_title": str(meta.get("title") or updates["video_title"]),
                "thumbnail_url": str(meta.get("thumbnail") or updates["thumbnail_url"]),
                "author": str(meta.get("author") or ""),
                "duration": float(meta.get("duration") or 0),
                "direct_audio_url": str(meta.get("audio_url") or ""),
            }
        )
        db_client.update_task_status(
            task_id,
            video_title=str(updates.get("video_title")),
            thumbnail_url=str(updates.get("thumbnail_url")),
            duration=float(updates.get("duration") or 0),
        )
    except Exception as e:
        logger.warning(f"Metadata extraction warning: {e}")

    # --- Step 3: Transcript Strategy ---
    result: Optional[Dict[str, Any]] = None

    # Strategy 1: Supadata
    if not result and is_youtube:
        result = await _ingest_supadata(video_url, task_id)

    # Strategy 2: VTT
    if not result and is_youtube:
        result = await _ingest_vtt(video_url, task_id)

    # Strategy 3: Whisper
    if not result:
        result = await _ingest_whisper(state)
        # Check for error in whisper result
        if result and "error" in result:
            err_list_w: List[str] = updates.get("errors", []) # type: ignore
            err_list_w.append(str(result["error"]))
            updates["ingest_error"] = str(result["error"])
            result = None

    # Merge results
    if result:
        updates.update(result)
        # Persist finalized script
        db_client.update_task_output_by_kind(
            task_id,
            str(OutputKind.SCRIPT_RAW),
            content=str(updates.get("transcript_raw") or ""),
            status=TaskStatus.COMPLETED,
            progress=100,
        )
        db_client.update_task_output_by_kind(
            task_id,
            str(OutputKind.SCRIPT),
            content=str(updates.get("transcript_text") or ""),
            status=TaskStatus.COMPLETED,
            progress=100,
        )
    else:
        if not updates["errors"]:
            # Type hint helps mypy understand this is a list of strings
            err_list: List[str] = updates.get("errors", []) # type: ignore
            err_list.append("All ingest strategies failed.")

        # Safe access to error message
        err_msg = ""
        if isinstance(updates.get("errors"), list) and updates["errors"]:
             err_msg = str(updates["errors"][0])

        db_client.update_task_status(
            task_id, status=TaskStatus.ERROR, error=err_msg
        )

    # Update Audio Logic
    if updates.get("direct_audio_url"):
        db_client.ensure_task_outputs(task_id, user_id, [str(OutputKind.AUDIO)])
        payload = {
            "audioUrl": updates["direct_audio_url"],
            "coverUrl": updates.get("thumbnail_url"),
        }
        db_client.update_task_output_by_kind(
            task_id,
            str(OutputKind.AUDIO),
            content=json.dumps(payload, ensure_ascii=False),
            status=TaskStatus.COMPLETED,
            progress=100,
        )

    return updates


# --- Cognition Helpers ---


async def _run_classify(transcript_text: str, task_id: str, video_url: str, user_id: str):
    try:
        logger.info("Cognition: Starting classification...")
        
        # Ensure Output Exists (in case Ingest was skipped via Cache Hit)
        db_client.ensure_task_outputs(task_id, user_id, [OutputKind.CLASSIFICATION])
        
        trace_meta = {
            "session_id": str(task_id),
            "metadata": {"video_url": video_url},
        }  # Simplified trace
        classification = await summarizer.classify_content(
            transcript_text, trace_metadata=trace_meta
        )

        if isinstance(classification, dict):
            import json

            content_str = json.dumps(classification, ensure_ascii=False)
        else:
            content_str = classification.model_dump_json()

        db_client.update_task_output_by_kind(
            task_id,
            str(OutputKind.CLASSIFICATION),
            content=content_str,
            status=TaskStatus.COMPLETED,
            progress=100,
        )
        return classification
    except Exception as e:
        logger.error(f"Cognition: Classification failed: {e}")
        return e


async def _run_summarize(
    transcript_text: str,
    task_id: str,
    user_id: str,
    classification_result: Optional[Dict[str, Any]] = None,
):
    try:
        logger.info("Cognition: Starting summarization...")
        trace_meta = {
            "session_id": str(task_id),
            "user_id": str(user_id),
            "metadata": {"node": "cognition_summarize"},
        }
        summary = await summarizer.summarize(
            transcript_text,
            trace_metadata=trace_meta,
            existing_classification=classification_result,
        )

        content = (
            summary.model_dump_json()
            if hasattr(summary, "model_dump_json")
            else json.dumps(summary)
        )
        db_client.update_task_output_by_kind(
            task_id,
            str(OutputKind.SUMMARY_SOURCE),
            content=content,
            status=TaskStatus.COMPLETED,
            progress=100,
        )
        return summary
    except Exception as e:
        logger.error(f"Cognition: Summarization failed: {e}")
        return e


async def cognition(state: VideoProcessingState) -> Dict:
    """Unified Cognition Node: Transcript -> Insights."""
    logger.info("Node: cognition")

    transcript_text = state.get("transcript_text")
    if not transcript_text:
        return {"errors": ["No transcript text available for cognition"]}

    # Smart Skip
    if len(transcript_text.strip()) < 50:
        logger.info("Transcript too short (<50 chars), skipping cognition.")
        return {"errors": ["Transcript too short for analysis"]}

    task_id = state["task_id"]

    # Debug Log for Verification (Print for Docker visibility)
    mode_msg = f"Cognition Execution Mode: Sequential={settings.COGNITION_SEQUENTIAL}, Delay={settings.COGNITION_DELAY}"
    logger.warning(mode_msg)
    print(mode_msg, flush=True)

    # Execute Parallel or Sequential based on config
    if settings.COGNITION_SEQUENTIAL:
        logger.info(f"Cognition: Sequential mode enabled (Delay: {settings.COGNITION_DELAY}s)")

        # 1. Classify
        classification_res = await _run_classify(transcript_text, task_id, state["video_url"], state["user_id"])

        # Delay if configured
        if settings.COGNITION_DELAY > 0:
            logger.info(f"Cognition: Sleeping for {settings.COGNITION_DELAY}s by configuration...")
            await asyncio.sleep(settings.COGNITION_DELAY)

        # 2. Summarize
        # PASS CLASSIFICATION RESULT TO AVOID REDUNDANT LLM CALLS
        summary_res = await _run_summarize(
            transcript_text, task_id, state["user_id"], classification_result=classification_res
        )

        # Unify results format for processing below
        results: List[Any] = [classification_res, summary_res]
    else:
        # Default: Parallel
        results_tuple = await asyncio.gather(
            _run_classify(transcript_text, task_id, state["video_url"], state["user_id"]),
            _run_summarize(transcript_text, task_id, state["user_id"]),
            return_exceptions=True,
        )
        results = list(results_tuple)

    updates = {}
    classification_res, summary_res = results[0], results[1]

    # Process Classification
    if isinstance(classification_res, Exception):
        logger.error(f"Classify Error: {classification_res}")
        updates["errors"] = [str(classification_res)]
    else:
        updates["classification_result"] = (
            classification_res.model_dump()
            if hasattr(classification_res, "model_dump")
            else classification_res
        )

    # Process Summary
    if isinstance(summary_res, Exception):
        logger.error(f"Summarize Error: {summary_res}")
        err = str(summary_res)
        if "errors" not in updates:
            updates["errors"] = []
        updates["errors"].append(err)
    elif summary_res:
        updates["final_summary_json"] = (
            summary_res.model_dump()
            if hasattr(summary_res, "model_dump")
            else summary_res
        )

    return updates


async def cleanup(state: VideoProcessingState) -> Dict:
    """Cleanup temp files and finalize task."""
    audio_path = state.get("audio_path")
    if audio_path:
        try:
            path = Path(audio_path)
            if path.exists():
                os.remove(path)
                logger.info(f"Deleted temp file: {path}")
        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")

    # Final Task Status Update
    if not state.get("errors"):
        db_client.update_task_status(
            state["task_id"], status=TaskStatus.COMPLETED, progress=100
        )

    return {}


# --- Graph Construction ---


def route_after_cache(state: VideoProcessingState):
    if state.get("cache_hit"):
        if not state.get("final_summary_json"):
            return "cognition"
        return "cleanup"
    return "ingest"


def build_graph():
    workflow = StateGraph(VideoProcessingState)
    workflow.add_node("check_cache", check_cache)
    workflow.add_node("ingest", ingest)
    workflow.add_node("cognition", cognition)
    workflow.add_node("cleanup", cleanup)

    workflow.set_entry_point("check_cache")
    workflow.add_conditional_edges(
        "check_cache",
        route_after_cache,
        {"cleanup": "cleanup", "ingest": "ingest", "cognition": "cognition"},
    )
    workflow.add_edge("ingest", "cognition")
    workflow.add_edge("cognition", "cleanup")
    workflow.add_edge("cleanup", END)

    return workflow.compile()


app = build_graph()
