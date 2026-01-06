import json
import logging
import os
import asyncio
from pathlib import Path
from typing import TypedDict, Optional, List, Dict, Any

from langgraph.graph import StateGraph, END

# Import existing instances/classes
from config import settings
from db_client import DBClient
from notifier import Notifier
from supadata_client import SupadataClient
from summarizer import Summarizer
from transcriber import Transcriber, format_markdown_from_raw_segments
from video_processor import VideoProcessor
from utils.url import normalize_video_url
from urllib.parse import urlparse

# Setup logger
logger = logging.getLogger(__name__)

# Initialize singletons (re-use the same patterns as main.py)
# Ideally these should be dependency injected, but for refactoring main.py we can import/init them here 
# OR passed in via config. For now, let's re-instantiate or share.
# To avoid double-init issues, we'll instantiate them here if they are stateless enough.
video_processor = VideoProcessor()
transcriber = Transcriber()
summarizer = Summarizer()
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
    transcript_text: Optional[str]      # Optimized/Clean
    transcript_raw: Optional[str]       # JSON with segments
    transcript_lang: str
    
    classification_result: Optional[Dict]
    source_summary_json: Optional[str]
    final_summary_json: Optional[str]

    # Processing Control
    cache_hit: bool
    is_youtube: bool
    
    # Status
    errors: List[str]

# --- Nodes ---

async def check_cache(state: VideoProcessingState) -> Dict:
    """Checks DB for existing completed tasks (deduplication)."""
    logger.info(f"Node: check_cache for {state['video_url']}")
    
    # Initialize defaults
    updates = {
        "cache_hit": False, 
        "errors": [],
        "is_youtube": "youtube.com" in state['video_url'] or "youtu.be" in state['video_url']
    }
    
    try:
        existing_task = db_client.find_latest_completed_task_by_url(state['video_url'])
        
        if existing_task:
            logger.info(f"Cache hit: {state['video_url']} found in task {existing_task['id']}")
            updates["cache_hit"] = True
            
            # Copy basic metadata from cache
            updates["video_title"] = existing_task.get('video_title') or "Unknown"
            updates["thumbnail_url"] = existing_task.get('thumbnail_url')
            
            # Update current task with cached metadata
            db_client.update_task_status(
                state['task_id'], 
                video_title=updates["video_title"], 
                thumbnail_url=updates["thumbnail_url"]
            )
            
            # Fetch and copy outputs
            existing_outputs = db_client.get_task_outputs(existing_task['id'])
            updates["transcript_text"] = ""
            
            for out in existing_outputs:
                if out.get("status") != "completed":
                    continue
                
                k = out.get("kind")
                val = out.get("content")
                loc = out.get("locale")
                
                # Copy reusable outputs
                if k in ["script", "script_raw", "summary_source", "audio"]:
                    try:
                        db_client.upsert_completed_task_output(state['task_id'], state['user_id'], k, val, locale=loc)
                        if k == "script":
                            updates["transcript_text"] = val
                        if k == "script_raw":
                            updates["transcript_raw"] = val
                        if k == "classification":
                             updates["classification_result"] = json.loads(val) if val else None
                        if k == "summary_source":
                             updates["source_summary_json"] = val
                    except Exception as e:
                        logger.warning(f"Failed to copy output {k}: {e}")

                # Copy match summary
                if k == "summary":
                    cached_locale = (loc or "zh").lower()
                    requested_locale = (state['summary_lang'] or "zh").lower()
                    
                    if cached_locale == requested_locale:
                        try:
                            # We don't upsert directly here, just mark as done in state? 
                            # Actually better to upsert here to save time.
                            db_client.upsert_completed_task_output(state['task_id'], state['user_id'], k, val, locale=loc)
                            updates["final_summary_json"] = val
                        except Exception as e:
                            logger.warning(f"Failed to copy match summary: {e}")
                            

            # Validate Cache Integrity
            if not updates.get("transcript_text"):
                logger.info("Cache hit but script missing/incomplete. Treating as Cache Miss.")
                updates["cache_hit"] = False
                updates["transcript_text"] = None # Reset
                # We should probably reset other things too, but fetch_data will overwrite/refine.
                
                # Note: We already copied partial outputs to DB. This is fine, they act as placeholders.
                # But we want the flow to proceed to fetch_data.
                
    except Exception as e:
        logger.error(f"Error in check_cache: {e}")
        # Non-fatal, just proceed as cache miss
        
    return updates

async def fetch_data(state: VideoProcessingState) -> Dict:
    """Fetches transcript + metadata. Tries Supadata first (for YT), else Download+Transcribe."""
    logger.info(f"Node: fetch_data for {state['video_url']}")
    
    updates = {}
    
    # If cache provided script, we skip fetch logic mostly, but might still need metadata
    if state.get("transcript_text"):
        logger.info("Script already cached. Skipping fetch/download.")
        return {}

    # Initialize Missing Outputs in DB (Pending)
    # This mirrors 'Phase 0' logic to ensure UI has placeholders
    # We do it here or assume caller did it. checking: caller (API) does basic placeholders.
    # But let's verify audio/summary_source exist.
    
    current_outputs = db_client.get_task_outputs(state['task_id'])
    existing_kinds = set(o['kind'] for o in current_outputs)
    
    # Ensure standard outputs exist (Robustness fix)
    needed_kinds = ["script", "script_raw", "summary_source"]
    if settings.SUMMARY_STRATEGY == "v2_classified":
        needed_kinds.append("classification")
        
    # Podcast logic for audio output
    host = urlparse(state['video_url']).hostname or ""
    host = host.replace("www.", "")
    if (host.endswith("xiaoyuzhoufm.com") or host.endswith("apple.com")):
         needed_kinds.append("audio")
         
    for k in needed_kinds:
        if k not in existing_kinds:
            try:
                db_client.create_task_output(state['task_id'], state['user_id'], kind=k)
                existing_kinds.add(k)
            except Exception as e:
                logger.warning(f"Failed to create output {k}: {e}")
    
    # 1. Supadata (YouTube only)
    transcript_result = None
    if state['is_youtube']:
        try:
            db_client.update_task_status(state['task_id'], status="processing", progress=20)
            md, raw, lang = await supadata_client.get_transcript_async(state['video_url'])
            if md and raw:
                # Store
                transcript_result = (md, raw, lang)
                updates["transcript_text"] = md # Temporary, will be optimized later
                updates["transcript_raw"] = raw
                updates["transcript_lang"] = lang
                logger.info("Supadata transcript fetched successfully.")
                
                # Persist raw script to DB immediately
                try:
                    outputs = db_client.get_task_outputs(state['task_id'])
                    script_raw_out = next((o for o in outputs if o['kind'] == 'script_raw'), None)
                    if script_raw_out:
                        db_client.update_output_status(script_raw_out['id'], status="completed", progress=100, content=raw)
                        
                    # Also persist the preliminary MD as script (it will be overwritten/optimized later, but good for safety)
                    script_out = next((o for o in outputs if o['kind'] == 'script'), None)
                    if script_out:
                         db_client.update_output_status(script_out['id'], status="processing", progress=50, content=md)
                except Exception as e:
                    logger.warning(f"Failed to persist Supadata outputs: {e}")
        except Exception as e:
            logger.warning(f"Supadata attempt failed: {e}")

    # 2. Metadata / Download
    db_client.update_task_status(state['task_id'], progress=30)
    
    # If we have transcript, just fetch metadata
    if transcript_result:
        try:
            info = await video_processor.extract_info_only(state['video_url'])
            # Extract info
            updates["video_title"] = info.get("title") or state.get("video_title") or "Unknown"
            updates["thumbnail_url"] = info.get("thumbnail") or state.get("thumbnail_url")
            updates["direct_audio_url"] = info.get("audio_url")
            updates["author"] = info.get("author")
            updates["duration"] = info.get("duration")
            
            # Update DB task
            db_client.update_task_status(
                state['task_id'],
                video_title=updates["video_title"],
                thumbnail_url=updates["thumbnail_url"],
                duration=updates["duration"]
            )
        except Exception as e:
            logger.warning(f"Metadata fetch failed: {e}")
            
    else:
        # Full Download required (Whisper fallback)
        logger.info("Downloading video for local transcription...")
        try:
            # Check temp dir
            TEMP_DIR = Path("temp") 
            TEMP_DIR.mkdir(exist_ok=True)
            
            audio_path, video_title, thumbnail_url, direct_audio_url, info = await video_processor.download_and_convert(state['video_url'], TEMP_DIR)
            
            updates["audio_path"] = audio_path
            updates["video_title"] = video_title
            updates["thumbnail_url"] = thumbnail_url
            updates["direct_audio_url"] = direct_audio_url
            updates["author"] = info.get("author")
            
             # Update DB task
            db_client.update_task_status(
                state['task_id'],
                video_title=video_title,
                thumbnail_url=thumbnail_url,
                duration=info.get("duration")
            )
            
        except Exception as e:
            err = f"Download failed: {str(e)}"
            logger.error(err)
            updates["errors"] = [err]
            db_client.update_task_status(state['task_id'], status="error", error=err)
            
    # Update Audio Output in DB
    try:
        # Check if we need to create audio output dynamically?
        # Usually created by fetch_data implies we have direct_audio_url
        if updates.get("direct_audio_url"):
            # Ensure audio output exists
            if "audio" not in existing_kinds:
                db_client.create_task_output(state['task_id'], state['user_id'], kind="audio")
                current_outputs = db_client.get_task_outputs(state['task_id']) # refresh
            
            audio_out = next((o for o in current_outputs if o['kind'] == 'audio'), None)
            if audio_out:
                payload = {
                    "audioUrl": updates["direct_audio_url"],
                    "coverUrl": updates.get("thumbnail_url"),
                }
                db_client.update_output_status(audio_out['id'], status="completed", progress=100, content=json.dumps(payload, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"Audio output update failed: {e}")

    return updates

async def transcribe(state: VideoProcessingState) -> Dict:
    """Runs Whisper if needed, and Optimizes transcript."""
    logger.info(f"Node: transcribe (Has Text: {bool(state.get('transcript_text'))})")
    
    if state.get('errors'):
        return {}
        
    updates = {}
    
    # If we already have text (from Supadata (fetch_data) or Cache), we might still need to optimize it.
    # Note: fetch_data sets `transcript_text` from Supadata result (Markdown).
    
    script_text = state.get("transcript_text")
    script_raw = state.get("transcript_raw")
    
    # 1. Transcribe (Whisper)
    if not script_text and state.get('audio_path'):
        db_client.update_task_status(state['task_id'], progress=40)
        
        # Find raw output to update progress
        # We need to look up output IDs. 
        # For simplicity, let's just use db_client helpers to find by task/kind if possible, or query all
        outputs = db_client.get_task_outputs(state['task_id'])
        script_out = next((o for o in outputs if o['kind'] == 'script'), None)
        script_raw_out = next((o for o in outputs if o['kind'] == 'script_raw'), None)
        
        if script_out:
            db_client.update_output_status(script_out['id'], status="processing", progress=10)
            
        try:
             script_text_with_timestamps, raw_json, detected_language = await transcriber.transcribe_with_raw(state['audio_path'])
             script_raw = raw_json
             updates["transcript_raw"] = raw_json
             updates["transcript_lang"] = detected_language
             # This is MD with timestamps
             script_text = script_text_with_timestamps 
             
             if script_raw_out:
                 db_client.update_output_status(script_raw_out['id'], status="completed", progress=100, content=raw_json)
                 
        except Exception as e:
             err = f"Transcribe failed: {e}"
             logger.error(err)
             updates["errors"] = [err]
             db_client.update_task_status(state['task_id'], status="error", error=err)
             return updates

    # 2. Optimize
    # We always optimize to get clean text for summary
    if script_text:
        # Identify if we need optimization
        # If it came from Supadata (fetch_data), it's MD with timestamps.
        # If it came from Whisper, it's MD with timestamps.
        # If it came from Cache, it's likely already clean? 
        #   - check_cache sets transcript_text from 'script' output content, which IS the clean/optimized version.
        
        is_already_clean = state.get("cache_hit") # Rough heuristic
        
        if not is_already_clean:
            # We need to clean it
             try:
                 if state.get("transcript_raw"): 
                     # Re-format from raw if available to ensure best input?
                     # Already done in transcribe_with_raw or supadata
                     pass
                 
                 # Optimization
                 # trace_metadata for langfuse
                 trace_meta = {
                    "session_id": str(state['task_id']),
                    "user_id": str(state['user_id']),
                    "metadata": {"video_url": state['video_url']}
                 }
                 
                 # Choose optim method
                 if state['is_youtube'] and state.get("transcript_raw"): # Supadata source usually
                     # Use fast regex clean
                     optimized = summarizer.fast_clean_transcript(script_text)
                 else:
                     # LLM clean
                     optimized = await summarizer.optimize_transcript(script_text, trace_metadata=trace_meta)
                 
                 updates["transcript_text"] = optimized
                 
                 # Save optimized script to DB
                 outputs = db_client.get_task_outputs(state['task_id'])
                 script_out = next((o for o in outputs if o['kind'] == 'script'), None)
                 if script_out:
                     db_client.update_output_status(script_out['id'], status="completed", progress=100, content=optimized)
                     
             except Exception as e:
                 logger.warning(f"Optimization failed: {e}")
                 # Fallback to current text
                 updates["transcript_text"] = script_text
        
    return updates

async def classify(state: VideoProcessingState) -> Dict:
    """Runs classification."""
    logger.info("Node: classify")
    if state.get('errors') or not state.get("transcript_text"):
        return {}
    
    updates = {}
    
    if settings.SUMMARY_STRATEGY == "v2_classified" and not state.get("classification_result"):
        outputs = db_client.get_task_outputs(state['task_id'])
        class_out = next((o for o in outputs if o['kind'] == 'classification'), None)
        
        if class_out:
             db_client.update_output_status(class_out['id'], status="processing", progress=10)
             try:
                 trace_meta = {
                    "session_id": str(state['task_id']), 
                    "user_id": str(state['user_id']),
                    "metadata": {"video_url": state['video_url']}
                }
                 classification_result = await summarizer.classify_content(state['transcript_text'], trace_metadata=trace_meta)
                 updates["classification_result"] = classification_result
                 
                 db_client.update_output_status(
                     class_out['id'],
                     status="completed",
                     progress=100,
                     content=json.dumps(classification_result, ensure_ascii=False),
                 )
             except Exception as e:
                 logger.warning(f"Classification failed: {e}")
                 db_client.update_output_status(class_out['id'], status="error", error=str(e))

    return updates

async def summarize(state: VideoProcessingState) -> Dict:
    """Generates Summary (Source + Translated)."""
    logger.info("Node: summarize")
    if state.get('errors') or not state.get("transcript_text"):
        return {}
    
    updates = {}
    
    # Check if we already have final summary (from cache)
    if state.get("final_summary_json"):
        return {}
        
    outputs = db_client.get_task_outputs(state['task_id'])
    summary_out = next((o for o in outputs if o['kind'] == 'summary'), None)
    summary_source_out = next((o for o in outputs if o['kind'] == 'summary_source'), None)
    
    if not summary_out and not summary_source_out:
        return {}
        
    # Generate Source Summary
    source_json = state.get("source_summary_json")
    
    # Detect lang from raw
    transcript_lang = state.get("transcript_lang") or "unknown"
    if transcript_lang == "unknown" and state.get("transcript_raw"):
        try:
             payload = json.loads(state["transcript_raw"])
             transcript_lang = payload.get("language") or "unknown"
        except: pass
    
    base_trace_meta = {
        "session_id": str(state['task_id']),
        "user_id": str(state['user_id']),
        "metadata": {"video_url": state['video_url']}
    }
    
    try:
        # 1. Source Summary
        if not source_json:
             if summary_source_out:
                 db_client.update_output_status(summary_source_out['id'], status="processing", progress=20)
             
             summary_trace = base_trace_meta.copy()
             summary_trace["metadata"]["kind"] = "summary_source"
             
             source_json = await summarizer.summarize_in_language_with_anchors(
                 state['transcript_text'],
                 summary_language=transcript_lang,
                 video_title=state['video_title'],
                 script_raw_json=state.get("transcript_raw"),
                 existing_classification=state.get("classification_result"),
                 trace_metadata=summary_trace,
             )
             updates["source_summary_json"] = source_json
             
             if summary_source_out:
                 db_client.update_output_status(summary_source_out['id'], status="completed", progress=100, content=source_json)
                 
        # 2. Translated Summary (Final)
        if summary_out and summary_out.get("status") != "completed":
             db_client.update_output_status(summary_out['id'], status="processing", progress=35)
             
             requested_lang = state['summary_lang'] or "zh"
             
             final_json = source_json
             if str(requested_lang).lower() != str(transcript_lang).lower():
                 final_json = await summarizer.translate_summary_json(
                     source_json,
                     target_language=requested_lang
                 )
            
             updates["final_summary_json"] = final_json
             db_client.update_output_status(summary_out['id'], status="completed", progress=100, content=final_json)
             
    except Exception as e:
        logger.error(f"Summarize failed: {e}")
        if summary_out: db_client.update_output_status(summary_out['id'], status="error", error=str(e))
        if summary_source_out: db_client.update_output_status(summary_source_out['id'], status="error", error=str(e))
        updates["errors"] = [str(e)]
        
    return updates

async def cleanup(state: VideoProcessingState) -> Dict:
    """Cleanup temp files."""
    if state.get("audio_path"):
        try:
            path = Path(state["audio_path"])
            if path.exists():
                os.remove(path)
                logger.info(f"Deleted temp file: {path}")
        except Exception as e:
            logger.warning(f"Cleanup failed: {e}")
    
    # Final Task Status Update
    if not state.get("errors"):
        db_client.update_task_status(state['task_id'], status="completed", progress=100)
    else:
        # If errors exist but we processed partially, we might still mark complete?
        # Current logic behaves like: if script done, successful. 
        # But let's stick to update logic inside nodes. 
        # Here we just ensure final stamp if no explicit error was set on task.
        pass
        
    return {}

# --- Graph Construction ---

def route_after_cache(state: VideoProcessingState):
    if state.get("cache_hit"):
        # Even if cache hit, we might need to translate summary if locale differs?
        # check_cache logic handles exact locale match. 
        # If final_summary_json is present, we are done.
        # If not, we might need to route to summarize.
        if not state.get("final_summary_json"):
             return "summarize"
        return "cleanup"
    return "fetch_data"

def build_graph():
    workflow = StateGraph(VideoProcessingState)
    
    workflow.add_node("check_cache", check_cache)
    workflow.add_node("fetch_data", fetch_data)
    workflow.add_node("transcribe", transcribe)
    workflow.add_node("classify", classify)
    workflow.add_node("summarize", summarize)
    workflow.add_node("cleanup", cleanup)
    
    workflow.set_entry_point("check_cache")
    
    workflow.add_conditional_edges(
        "check_cache",
        route_after_cache,
        {
            "cleanup": "cleanup",
            "fetch_data": "fetch_data",
            "summarize": "summarize"
        }
    )
    
    workflow.add_edge("fetch_data", "transcribe")
    workflow.add_edge("transcribe", "classify")
    workflow.add_edge("classify", "summarize")
    workflow.add_edge("summarize", "cleanup")
    workflow.add_edge("cleanup", END)
    
    return workflow.compile()

app = build_graph()
