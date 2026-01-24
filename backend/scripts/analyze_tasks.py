import os
import sys
import json
from datetime import datetime
from dateutil import parser
# Add parent directory to path to allow importing from backend
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)

from utils.env_loader import load_env
load_env()

from db_client import DBClient

def calculate_duration(start, end):
    if not start or not end:
        return None
    try:
        start_time = parser.parse(start)
        end_time = parser.parse(end)
        return (end_time - start_time).total_seconds()
    except Exception as e:
        return None

def main():
    db = DBClient()
    if not db.supabase:
        print("Failed to initialize Supabase client.")
        return

    print("Fetching last 5 tasks...")
    
    try:
        # Fetch last 5 tasks
        response = db.supabase.table("tasks") \
            .select("*") \
            .order("created_at", desc=True) \
            .limit(5) \
            .execute()
        
        tasks = response.data
        
        print(f"\nFound {len(tasks)} tasks.\n")
        
        for task in tasks:
            task_id = task.get('id')
            created_at = task.get('created_at')
            updated_at = task.get('updated_at')
            status = task.get('status')
            video_url = task.get('video_url')
            video_title = task.get('video_title') or "N/A"
            
            total_duration = calculate_duration(created_at, updated_at)
            
            # Display Task ID and Title on the same line as requested
            print(f"Task ID: {task_id}  |  Title: {video_title}")
            print(f"URL: {video_url}")
            print(f"Status: {status}")
            print(f"Created At: {created_at}")
            print(f"Updated At: {updated_at}")
            print(f"Total Duration: {total_duration:.2f}s" if total_duration else "Total Duration: N/A")
            
            # Fetch outputs for detailed breakdown
            outputs_response = db.supabase.table("task_outputs") \
                .select("*") \
                .eq("task_id", task_id) \
                .execute()
            
            outputs = outputs_response.data
            
            # Sort outputs by created_at to see the sequence
            outputs.sort(key=lambda x: x.get('created_at', ''))
            
            print("  Detailed Steps:")
            for output in outputs:
                kind = output.get('kind')
                o_status = output.get('status')
                o_created = output.get('created_at')
                o_updated = output.get('updated_at')
                o_duration = calculate_duration(o_created, o_updated)
                
                start_offset = (parser.parse(o_created) - parser.parse(created_at)).total_seconds()
                end_offset = (parser.parse(o_updated) - parser.parse(created_at)).total_seconds()
                
                content_len = len(output.get('content') or "")
                print(f"    - [{kind}] Status: {o_status} | Size: {content_len} chars")
                print(f"      Duration: {o_duration:.2f}s" if o_duration else "      Duration: N/A")
                print(f"      Timeline: T+{start_offset:.1f}s -> T+{end_offset:.1f}s")
                if o_status == 'error':
                    print(f"      Error: {output.get('error_message')}")

            print("-" * 50)
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
