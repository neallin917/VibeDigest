import asyncio
import os
import sys
import logging

# Ensure backend root is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from db_client import DBClient
from main import _execute_pipeline_core, MAX_CONCURRENT_JOBS, processing_limiter
from config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def rerun_demo_tasks():
    logger.info("Starting Demo Task Rerun Script...")

    # 1. Force V2 Strategy
    settings.SUMMARY_STRATEGY = "v2_classified"
    logger.info(f"Forced SUMMARY_STRATEGY = {settings.SUMMARY_STRATEGY}")

    db = DBClient()

    # 2. Fetch Demo Tasks
    # Depending on DB structure, 'is_demo' might filter differently.
    # We use raw query since DBClient doesn't have a specific filtered getter exposed publicly for lists
    # except get_task_outputs.
    # We'll use _execute_query directly.
    
    query = "SELECT * FROM tasks WHERE is_demo = true ORDER BY created_at DESC"
    tasks = db._execute_query(query)
    
    logger.info(f"Found {len(tasks)} demo tasks.")
    
    if len(tasks) == 0:
        logger.warning("No demo tasks found. Exiting.")
        return

    # Verify count (sanity check against the '6' expectation)
    if len(tasks) != 6:
        logger.warning(f"Expected 6 tasks, found {len(tasks)}. Proceeding with ALL found tasks.")
        for t in tasks:
            logger.info(f" - {t['video_title']} (ID: {t['id']})")
    
    # 3. Reset and Re-run
    # We process them sequentially or with limited concurrency to be safe,
    # though usage of _execute_pipeline_core handles concurrency via semaphore usually,
    # but we are calling the internal function directly.
    # Wait, _execute_pipeline_core does NOT hold the semaphore. run_pipeline does.
    # But we want to bypass some run_pipeline overheads or just call it directly?
    # run_pipeline initializes Langfuse trace. Better to call run_pipeline-like logic but
    # WITHOUT creating a NEW background task if we want to wait for it script-style.
    
    # We will simulate the core pipeline call.
    
    tasks_to_process = []
    
    for task in tasks:
        task_id = task['id']
        user_id = task['user_id']
        video_url = task['video_url']
        video_title = task['video_title']
        
        logger.info(f"--- Preparing Task: {video_title} ({task_id}) ---")
        
        # A. Reset Output Statuses
        # We want to force re-generation of:
        # - summary
        # - summary_source
        # - classification
        # We leave 'script' and 'script_raw' intact to save transcription time/cost.
        
        outputs = db.get_task_outputs(task_id)
        
        kinds_to_reset = ['summary', 'summary_source', 'classification']
        
        for kind in kinds_to_reset:
            # Find output(s)
            matched = [o for o in outputs if o['kind'] == kind]
            for out in matched:
                logger.info(f"Resetting output {kind} ({out['id']}) to pending...")
                # We also clear content to ensure no stale data remains if we want a fresh start
                # although specific update functions might overwrite it.
                # Just change status to pending.
                db.update_output_status(out['id'], status='pending', progress=0, error='')
        
        # Also ensure 'classification' output exists!
        # If it was a legacy task, it might not have one.
        has_class = any(o['kind'] == 'classification' for o in outputs)
        if not has_class:
            logger.info(f"Creating missing classification output for {task_id}")
            db.create_task_output(task_id, user_id, kind='classification')
            
        # B. Set Task Status to PROCESSING
        # This is CRITICAL to avoid the 'cache hit' logic in _execute_pipeline_core
        # which looks for 'completed' tasks.
        db.update_task_status(task_id, status='processing', progress=10)
        
        tasks_to_process.append((task_id, video_url, "zh", user_id))

    logger.info("All tasks prepared. Starting processing Loop...")
    
    # Process
    # We can run them concurrently respecting the limit
    sem = asyncio.Semaphore(4) # Same as main.py limit
    
    async def process_wrapper(tid, url, lang, uid):
        async with sem:
            logger.info(f"Processing {tid}...")
            # We use 'zh' as default summary language for these demos, 
            # or we could try to infer from existing summary output locale.
            # For now, forcing 'zh' as per typical demo needs (or matching the image which has Chinese text).
            
            # Find requested locale from existing summary output to be safe?
            outputs = db.get_task_outputs(tid)
            sum_out = next((o for o in outputs if o['kind'] == 'summary'), None)
            target_lang = "zh"
            if sum_out and sum_out.get('locale'):
                target_lang = sum_out.get('locale')
            
            await _execute_pipeline_core(tid, url, target_lang, uid)
            logger.info(f"Finished {tid}")

    jobs = [process_wrapper(*args) for args in tasks_to_process]
    await asyncio.gather(*jobs)
    
    logger.info("Done. All tasks re-processed.")

if __name__ == "__main__":
    asyncio.run(rerun_demo_tasks())
