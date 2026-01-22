import asyncio
import logging
import os
import sys
from dotenv import load_dotenv

# Add backend to path to allow imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

# Load .env from backend directory before importing other modules
env_path = os.path.join(backend_dir, '.env')
load_dotenv(env_path)

from db_client import DBClient
from workflow import app as workflow_app
from config import settings

# Configure Logging to stdout
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def run_test():
    db = DBClient()
    video_url = "https://www.youtube.com/watch?v=l0h3nAW13ao"
    
    logger.info("--- Starting Manual Test ---")
    logger.info(f"Video URL: {video_url}")
    logger.info(f"Config: Sequential={settings.COGNITION_SEQUENTIAL}, Delay={settings.COGNITION_DELAY}")

    # 1. Get a valid user
    logger.info("Fetching a valid user ID from profiles...")
    try:
        users = db._execute_query("SELECT id FROM profiles LIMIT 1")
        if not users:
            logger.error("No users found in profiles table. Cannot run test.")
            return
        user_id = users[0]['id']
        logger.info(f"Using User ID: {user_id}")
    except Exception as e:
        logger.error(f"Failed to fetch user: {e}")
        return

    # 2. Create Task
    logger.info("Creating Task...")
    try:
        task = db.create_task(user_id=user_id, video_url=video_url)
        task_id = task['id']
        logger.info(f"Task Created: {task_id}")
        
        # 3. Create Outputs (Mimic main.py)
        db.create_task_output(task_id, user_id, kind="script")
        db.create_task_output(task_id, user_id, kind="summary", locale="zh")
        db.create_task_output(task_id, user_id, kind="comprehension_brief", locale="zh")
        
        # 4. Prepare State
        state = {
            "task_id": task_id,
            "user_id": user_id,
            "video_url": video_url,
            "summary_lang": "zh",
            "errors": [],
            "cache_hit": False,
            "is_youtube": False, # Logic in node accepts this initial state
        }
        
        # 5. Invoke Workflow
        logger.info("Invoking Graph...")
        await workflow_app.ainvoke(state)
        
        logger.info("--- Workflow Finished ---")
        
    except Exception as e:
        logger.error(f"Workflow execution failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
