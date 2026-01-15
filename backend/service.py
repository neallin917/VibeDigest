import asyncio
import logging
import os
from contextlib import nullcontext, contextmanager
from typing import Optional

from config import settings
from db_client import DBClient
from workflow import app as workflow_app

logger = logging.getLogger(__name__)

# Initialize DB Client
db_client = DBClient()

# Langfuse V3 setup
try:
    from langfuse import get_client as get_langfuse_client, propagate_attributes
except ImportError:
    def get_langfuse_client():
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
    async with processing_limiter:
        logger.info(f"Task {task_id} acquiring execution slot... (Active: {MAX_CONCURRENT_JOBS - processing_limiter._value})")
        
        # Langfuse V3
        langfuse = get_langfuse_client()
        observation_ctx = (
            langfuse.start_as_current_observation(
                as_type="span",
                name="Video Processing Pipeline",
                input={"video_url": video_url, "summary_lang": summary_lang}
            ) if langfuse else nullcontext()
        )
        
        with observation_ctx:
            with propagate_attributes(
                session_id=str(task_id),
                user_id=str(user_id),
                tags=["pipeline"]
            ):
                logger.info(f"[Pipeline Start] Task={task_id}, URL={video_url}, Lang={summary_lang}")
                
                try:
                    # Initialize input state
                    initial_state = {
                        "task_id": task_id,
                        "user_id": user_id,
                        "video_url": video_url,
                        "summary_lang": summary_lang,
                        "errors": [],
                        "cache_hit": False,
                        "is_youtube": False
                    }
                    
                    # Invoke Graph
                    await workflow_app.ainvoke(initial_state)
                    
                except Exception as e:
                    logger.error(f"Pipeline crashed: {e}")
                    db_client.update_task_status(task_id, status="error", error=str(e))
