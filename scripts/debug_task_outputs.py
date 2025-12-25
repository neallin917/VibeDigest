
import asyncio
import os
import sys
import json
import logging
from pprint import pprint
from pathlib import Path
from dotenv import load_dotenv

# Add backend to sys.path to import modules
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.append(str(backend_path))

# Load backend env
load_dotenv(backend_path / ".env")

from db_client import DBClient

DEMO_TASK_ID = "1e60a06c-ef37-4f82-bffd-1a5135cb45c7"

def main():
    task_id = sys.argv[1] if len(sys.argv) > 1 else DEMO_TASK_ID
    print(f"Inspecting outputs for Task ID: {task_id}")
    
    db = DBClient()
    outputs = db.get_task_outputs(task_id)
    
    print(f"Found {len(outputs)} outputs.")
    
    for o in outputs:
        print("-" * 40)
        print(f"ID: {o['id']}")
        print(f"Kind: {o['kind']}")
        print(f"Locale: {o['locale']}")
        print(f"Status: {o['status']}")
        # print(f"Content Preview: {o['content'][:100]}...")
        if o['kind'] == 'summary':
             try:
                 content = json.loads(o['content'])
                 print(f"Language in JSON: {content.get('language')}")
             except:
                 print("Content is not valid JSON")
        
        if o['kind'] == 'script_raw':
            try:
                content = json.loads(o['content'])
                print(f"Detected Language in Script Source: {content.get('language')}")
            except:
                print("Script Raw content is not valid JSON")


if __name__ == "__main__":
    main()
