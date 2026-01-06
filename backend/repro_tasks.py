import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Setup env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Add backend to path
sys.path.append(str(Path(__file__).parent))

from db_client import DBClient

async def reproduce():
    db = DBClient()
    
    # 1. Create User
    # We'll use a hardcoded user or fetch one
    # For safety, let's assume we can use a dummy UUID if possible, but foreign key constraints might fail.
    # So we fetch the first user from profiles or similar.
    try:
        users = db._execute_query("SELECT id FROM auth.users LIMIT 1")
        if not users:
            # Try profiles
            users = db._execute_query("SELECT id FROM profiles LIMIT 1")
            
        if not users:
            print("No users found to test with.")
            return

        user_id = users[0]['id']
        print(f"Using User ID: {user_id}")
        
        video_url = "https://www.youtube.com/watch?v=TEST_VIDEO_123"

        # 2. Create Task A (Simulate Fail)
        task_a = db.create_task(user_id, video_url)
        print(f"Created Task A: {task_a['id']}")
        
        # Manually set to error
        db.update_task_status(task_a['id'], status="error", error="Simulated Failure")
        
        # Verify A is error
        t_a = db.get_task(task_a['id'])
        print(f"Task A Status (Before B): {t_a['status']}")
        assert t_a['status'] == 'error'

        # 3. Create Task B (Simulate Success)
        task_b = db.create_task(user_id, video_url)
        print(f"Created Task B: {task_b['id']}")
        
        # Run logic that might trigger the bug
        # In main.py, when B starts, it checks for *completed* tasks.
        existing = db.find_latest_completed_task_by_url(video_url)
        if existing:
            print(f"Found existing completed task: {existing['id']}")
            # But A is error, so it should be None
        else:
            print("No existing completed task found (Correct).")
            
        # Simulate B completion
        db.update_task_status(task_b['id'], status="completed", progress=100)
        
        # 4. Check Task A Status again
        t_a_after = db.get_task(task_a['id'])
        print(f"Task A Status (After B success): {t_a_after['status']}")
        
        if t_a_after['status'] == 'completed':
            print("BUG REPRODUCED: Task A became completed!")
        else:
            print("Task A remained 'error'. Backend logic seems fine.")

        # Cleanup
        db._execute_query("DELETE FROM tasks WHERE id IN (:id1, :id2)", {"id1": task_a['id'], "id2": task_b['id']})
        print("Cleanup done.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(reproduce())
