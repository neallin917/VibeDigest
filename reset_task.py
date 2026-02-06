import os
from dotenv import load_dotenv

load_dotenv('.env')
load_dotenv('.env.local', override=True)

if os.environ.get("LOG_FILE_RETENTION") == "10":
    os.environ["LOG_FILE_RETENTION"] = "10 days"

db_url = os.environ.get("DATABASE_URL", "")
if db_url.startswith("postgresql://"):
    os.environ["DATABASE_URL"] = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

try:
    from backend.db_client import DBClient
    db = DBClient()
    tid = '0fe22ed1-50c1-4e7e-9cad-9081196eda6b'
    
    # 1. Reset Task Status
    db._execute_query(
        "UPDATE tasks SET status='pending', progress=0, error_message=NULL WHERE id = :id", 
        {'id': tid}
    )
    # 2. Delete or Reset Outputs (Deleting is safer to ensure fresh run)
    db._execute_query(
        "DELETE FROM task_outputs WHERE task_id = :tid", 
        {'tid': tid}
    )
    
    print(f"Reset Task {tid} to pending and cleared outputs.")
except Exception as e:
    print(f"Error: {e}")
