import asyncio
import logging
import uuid
from typing import Dict, Any, Annotated

from langchain_core.tools import tool
from langchain_core.runnables.config import RunnableConfig

from db_client import DBClient
from service import run_pipeline
from video_processor import VideoProcessor
from utils.url import normalize_video_url
from config import settings

logger = logging.getLogger(__name__)

# Initialize singletons for tools to use
db_client = DBClient()
video_processor = VideoProcessor()

@tool
async def preview_video(url: str) -> Dict[str, Any]:
    """
    Get a preview of the video/podcast (title, thumbnail) from a URL.
    Use this BEFORE processing to confirm with the user.
    """
    try:
        url = normalize_video_url(url)
        info = await video_processor.extract_info_only(url)
        return {
            "title": info.get("title", "Unknown"),
            "thumbnail": info.get("thumbnail", ""),
            "duration": info.get("duration", 0),
            "author": info.get("author", "Unknown"),
            "url": url
        }
    except Exception as e:
        logger.error(f"Preview failed: {e}")
        return {"error": str(e)}

@tool
async def create_processing_task(
    url: str, 
    config: RunnableConfig
) -> Dict[str, Any]:
    """
    Start processing a video/podcast (transcribe, summarize) from the URL.
    Returns the task_id to track progress.
    """
    try:
        # Extract user_id from config
        user_id = config.get("configurable", {}).get("user_id")
        if not user_id:
            logger.warning("No user_id found in config, using default/mock.")
            # Fallback or error? For MVP let's error if strictly needed, or mock.
            if settings.MOCK_MODE:
                 user_id = "mock-user"
            else:
                 return {"error": "User context missing (authentication error)"}

        if settings.MOCK_MODE:
            logger.info(f"MOCK MODE: Create task for {url}")
            return {
                "task_id": "mock-task-" + str(uuid.uuid4())[:8],
                "status": "started",
                "message": "Mock processing started (DB disconnected)"
            }

        url = normalize_video_url(url)
        
        # 2. Create Task
        task = db_client.create_task(user_id, url)
        task_id = task['id']

        # 3. Create Placeholders
        db_client.create_task_output(task_id, user_id, kind="script")
        db_client.create_task_output(task_id, user_id, kind="summary", locale="zh") # Default
        db_client.create_task_output(task_id, user_id, kind="comprehension_brief", locale="zh")

        logger.info(f"Tool starting task {task_id} for user {user_id}")

        # 4. Start Background Task (Fire & Forget)
        asyncio.create_task(run_pipeline(task_id, url, "zh", user_id))
        
        return {
            "task_id": task_id,
            "status": "started", 
            "message": "Processing started. Monitor progress via realtime."
        }
    except Exception as e:
        logger.error(f"Create task failed: {e}")
        return {"error": str(e)}

# Export tool list
def get_tools_list():
    return [preview_video, create_processing_task]
