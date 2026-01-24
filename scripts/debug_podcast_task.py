import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load envs
backend_env_path = Path("backend/.env")
if backend_env_path.exists():
    print(f"Loading envs from {backend_env_path}")
    load_dotenv(backend_env_path)
else:
    print("Warning: backend/.env not found")

# Add backend directory to sys.path to import modules
sys.path.append(os.path.join(os.getcwd(), "backend"))

from db_client import DBClient


async def main():
    db = DBClient()

    # Search for the task
    print("Searching for task 'The State of AI & Education'...")

    # We don't have a search by title method exposed easily, but we can list recent tasks or search manually if needed.
    # Actually, let's just query tasks table directly via supabase client in db_client

    # Try exact match or partial
    res = (
        db.supabase.table("tasks")
        .select("*")
        .ilike("video_title", "%The State of AI & Education%")
        .execute()
    )

    tasks = res.data

    if not tasks:
        print("Task not found.")
        return

    task = tasks[0]
    print(f"Found Task: {task['id']}")
    print(f"Title: {task['video_title']}")
    print(f"URL: {task['video_url']}")

    # Get outputs
    outputs = db.get_task_outputs(task["id"])

    print("\nOutputs:")
    for o in outputs:
        print(f"- Kind: {o['kind']}, Status: {o['status']}")
        if o["kind"] == "audio":
            print(f"  Content: {o['content']}")


if __name__ == "__main__":
    asyncio.run(main())
