import asyncio
import sys
import logging
from pathlib import Path

# Setup path and env
sys.path.append(str(Path(__file__).parent.parent))

from utils.env_loader import load_env
load_env()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

from workflow import app, VideoProcessingState  # noqa: E402
from db_client import DBClient  # noqa: E402

async def rerun_task(task_id: str):
    db_client = DBClient()
    
    # 1. Fetch Task Info
    task = db_client.get_task(task_id)
    if not task:
        logger.error(f"Task {task_id} not found.")
        return

    logger.info(f"Targeting Task: {task_id}")
    logger.info(f"URL: {task['video_url']}")

    # 2. Reset Task and Outputs
    # Note: We need to set status to 'processing' to allow nodes to update it
    db_client.update_task_status(task_id, status="processing", progress=10)
    
    outputs = db_client.get_task_outputs(task_id)
    summary_lang = "en"
    for o in outputs:
        # Reset output status to pending and clear content
        db_client.update_output_status(o['id'], status="pending", progress=0, content=None)
        if o['kind'] == 'summary' and o['locale']:
            summary_lang = o['locale']

    # 3. Initialize State
    initial_state = VideoProcessingState(
        task_id=task_id,
        user_id=task['user_id'],
        video_url=task['video_url'],
        summary_lang=summary_lang,
        video_title=task.get('video_title') or "",
        thumbnail_url=task.get('thumbnail_url') or "",
        author=task.get('author') or "",
        duration=float(task.get('duration') or 0),
        audio_path=None,
        direct_audio_url=None,
        transcript_text=None,
        transcript_raw=None,
        transcript_lang="",
        classification_result=None,
        source_summary_json=None,
        final_summary_json=None,
        cache_hit=False,
        is_youtube=True, # Video is YT
        errors=[]
    )

    logger.info("--- Starting Rerun Workflow ---")
    
    # 4. Run Workflow
    final_state = await app.ainvoke(initial_state)
    
    logger.info("\n--- Rerun Finished ---")
    if final_state.get('errors'):
        logger.error(f"Errors: {final_state['errors']}")
    else:
        logger.info("Rerun SUCCESS.")
        logger.info(f"Final Transcript (clean) length: {len(final_state.get('transcript_text', ''))}")
        # Logic check: If AI Guard worked, it should have forced fallback, 
        # meaning audio_path should have been set during fetch_data
        if final_state.get("audio_path"):
            logger.info("✅ SUCCESS: Workflow correctly fell back to local download/transcription due to AI Guard.")
        else:
            logger.warning("⚠️ Workflow did not fall back. Check AI Guard logs.")

if __name__ == "__main__":
    TASK_ID = "4bd44e42-40ea-4b01-a2ee-b738c3423a6a"
    asyncio.run(rerun_task(TASK_ID))
