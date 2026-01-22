import asyncio
import json
import os
import logging
from comprehension import ComprehensionAgent
from db_client import DBClient
from dotenv import load_dotenv
from pathlib import Path

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load env vars
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

async def run_musk_comprehension_real():
    task_id = "41cb3a14-6726-4516-a983-4a2f3572c157"
    db = DBClient()
    
    # Init DB engine manually since we are in a standalone script
    from sqlalchemy import create_engine
    db.engine = create_engine(os.getenv("DATABASE_URL") or "sqlite:///:memory:")
    
    print(f"Fetching transcript for task: {task_id}")
    outputs = db.get_task_outputs(task_id)
    script_output = next((o for o in outputs if o['kind'] == 'script'), None)
    
    if not script_output:
        print("Error: Script not found in DB")
        return

    agent = ComprehensionAgent()
    print(f"Generating Comprehension Brief using prioritized models...")
    
    # Generate in Chinese
    brief_json = await agent.generate_comprehension_brief(
        script_output['content'], 
        target_language="zh"
    )
    
    print("Generation successful. Upserting to database...")
    
    # Get user_id from task to maintain consistency
    task = db.get_task(task_id)
    user_id = task['user_id'] if task else None
    
    # Save to DB (using upsert to avoid duplicates or handles placeholders)
    db.upsert_completed_task_output(
        task_id=task_id,
        user_id=user_id,
        kind="comprehension_brief",
        content=brief_json
    )
    
    print("\n--- SUCCESSFULLY UPDATED DATABASE ---")
    print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(run_musk_comprehension_real())
