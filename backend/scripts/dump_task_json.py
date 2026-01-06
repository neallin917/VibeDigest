import sys
import json
from pathlib import Path
from dotenv import load_dotenv

# Setup path to import backend modules
sys.path.append(str(Path(__file__).parent.parent))
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from db_client import DBClient

def dump_task():
    db = DBClient()
    # Get latest task
    query = "SELECT * FROM tasks ORDER BY created_at DESC LIMIT 1"
    tasks = db._execute_query(query)
    
    if not tasks:
        print("No tasks found.")
        return

    task = tasks[0]
    task_id = task['id']
    print(f"Dumping data for task: {task_id}")
    
    outputs = db.get_task_outputs(task_id)
    
    dump_data = {
        "task": {k: str(v) for k, v in task.items()},
        "outputs": {}
    }
    
    for out in outputs:
        kind = out['kind']
        content = out.get('content')
        if content:
            try:
                # Try to parse JSON content
                dump_data["outputs"][kind] = json.loads(content)
            except:
                dump_data["outputs"][kind] = content
                
    with open("task_dump.json", "w", encoding='utf-8') as f:
        json.dump(dump_data, f, indent=2, ensure_ascii=False)
    
    print("Dumped to task_dump.json")

if __name__ == "__main__":
    dump_task()
