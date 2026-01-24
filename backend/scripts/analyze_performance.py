import os
import sys
from datetime import datetime

# Add backend to path so we can import db_client
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv()

from db_client import DBClient  # noqa: E402

def parse_time(ts_str):
    if not ts_str:
        return None
    # Handle Supabase timestamp format (might contain +00:00 or Z)
    if ts_str.endswith('Z'):
        ts_str = ts_str[:-1] + '+00:00'
    return datetime.fromisoformat(ts_str)

def main():
    db = DBClient()
    if not db.supabase:
        print("Failed to initialize Supabase client. Check environment variables.")
        return

    # Fetch last 5 completed tasks
    # Note: supabase-py syntax
    try:
        response = db.supabase.table("tasks") \
            .select("*") \
            .eq("status", "completed") \
            .order("created_at", desc=True) \
            .limit(5) \
            .execute()
        
        tasks = response.data
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        return

    if not tasks:
        print("No completed tasks found.")
        return

    print(f"Found {len(tasks)} recent completed tasks.\n")

    for task in tasks:
        task_id = task['id']
        created_at = parse_time(task['created_at'])
        updated_at = parse_time(task.get('updated_at')) # Task completion time
        
        print(f"Task ID: {task_id}")
        print(f"  Title: {task.get('video_title', 'Unknown')}")
        print(f"  Submitted: {created_at}")
        
        if created_at and updated_at:
            total_duration = (updated_at - created_at).total_seconds()
            print(f"  Total Duration: {total_duration:.2f}s")
        else:
            print("  Total Duration: Unknown")

        # Fetch outputs to guess steps
        try:
            out_resp = db.supabase.table("task_outputs").select("*").eq("task_id", task_id).execute()
            outputs = out_resp.data
        except Exception as e:
            print(f"  Error fetching outputs: {e}")
            outputs = []

        script_out = next((o for o in outputs if o['kind'] == 'script'), None)
        summary_out = next((o for o in outputs if o['kind'] == 'summary'), None)

        # Analysis
        # Flow: Start -> (Download + Transcribe) -> Script Done -> (Summarize) -> Summary Done -> Task Done
        
        script_end = parse_time(script_out['updated_at']) if script_out else None
        summary_end = parse_time(summary_out['updated_at']) if summary_out else None

        # 1. Download + Transcribe
        if script_end and created_at:
            dt_duration = (script_end - created_at).total_seconds()
            print(f"  - Download & Transcribe: {dt_duration:.2f}s")
        
        # 2. Summarize (Script End -> Summary End)
        if summary_end and script_end:
            # Note: Sometimes summary might finish BEFORE script update propagates if parallel? 
            # But usually it is sequential.
            summ_duration = (summary_end - script_end).total_seconds()
            if summ_duration < 0:
                summ_duration = 0 # Anomaly or parallel update race
            print(f"  - Summarize & Translate: {summ_duration:.2f}s")
        elif summary_end and created_at:
             # Fallback if script time missing
             summ_duration = (summary_end - created_at).total_seconds()
             print(f"  - Total to Summary: {summ_duration:.2f}s")

        print("-" * 40)

if __name__ == "__main__":
    main()
