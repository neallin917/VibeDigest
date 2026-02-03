import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))
from utils.env_loader import load_env
load_env()

from db_client import DBClient
db = DBClient()
query = """
    SELECT t.id, t.video_title, t.is_demo, o.content 
    FROM tasks t
    LEFT JOIN task_outputs o ON o.task_id = t.id AND o.kind = 'summary'
    WHERE t.is_demo = true
"""
rows = db._execute_query(query)
print(f"Found {len(rows)} demo tasks:")
for r in rows:
    has_summary = "YES" if r['content'] else "NO"
    ver = "?"
    if r['content']:
        import json
        try:
            ver = json.loads(r['content']).get('version', '?')
        except:
            ver = "ERR"
    print(f"{r['id']} | {has_summary} (V{ver}) | {r['video_title'][:50]}")
