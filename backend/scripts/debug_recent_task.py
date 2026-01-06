import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Setup path to import backend modules
sys.path.append(str(Path(__file__).parent.parent))
print(f"Path: {sys.path}")

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from db_client import DBClient

def inspect_recent_task():
    db = DBClient()
    
    # 1. Get most recent task
    # DBClient doesn't have a direct "get_latest_task" method exposed widely, 
    # but we can use execute_query directly or add a helper.
    # Let's use direct query for this script.
    
    query = "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1"
    tasks = db._execute_query(query)
    
    if not tasks:
        print("No tasks found.")
        return

    task = tasks[0]
    print(f"\n=== Latest Task: {task['id']} ===")
    print(f"URL: {task['video_url']}")
    print(f"Status: {task['status']}")
    print(f"Created: {task['created_at']}")
    print(f"Error: {task.get('error')}")
    
    # 2. Get Outputs
    outputs = db.get_task_outputs(task['id'])
    print(f"\n=== Outputs ({len(outputs)}) ===")
    
    for out in outputs:
        print(f"\n--- Output: {out['kind']} ({out['status']}) ---")
        content = out.get('content')
        if not content:
            print("[Empty Content]")
            continue
            
        if len(content) > 500:
            print(f"Content (First 500 chars):\n{content[:500]}...")
            print(f"\n[... Total Length: {len(content)} chars ...]")
            
            # If it looks like JSON, try to pretty print a bit
            if content.strip().startswith("{"):
                try:
                    parsed = json.loads(content)
                    print("JSON Keys:", list(parsed.keys()))
                except:
                    pass
        else:
            print(f"Content:\n{content}")

if __name__ == "__main__":
    inspect_recent_task()
