
import os
import sys
import json
from dotenv import load_dotenv, find_dotenv
import datetime

# Load environment variables
load_dotenv(find_dotenv('.env.local'))
load_dotenv(find_dotenv('.env'))

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db_client import DBClient
from backend.utils.url import normalize_video_url

def main():
    task_ids = [
        "40130d1e-d86f-471b-ade2-de594caef5e5",
        "f15eed95-0dae-42c1-bfaf-b022b3f1fd42"
    ]
    
    if len(sys.argv) > 1:
        task_ids = sys.argv[1:]

    try:
        client = DBClient()
    except Exception as e:
        print(f"Failed to init DBClient: {e}")
        return
    
    print(f"Checking {len(task_ids)} tasks...")
    
    tasks_data = []

    for tid in task_ids:
        print(f"\n--- Task: {tid} ---")
        try:
            task = client.get_task(tid)
        except Exception as e:
            print(f"Error fetching task {tid}: {e}")
            continue

        if not task:
            print("Task not found.")
            continue
            
        video_url = task.get('video_url')
        try:
            normalized = normalize_video_url(video_url)
        except Exception as e:
            normalized = f"ERROR: {e}"
        
        print(f"Raw URL:        {video_url}")
        print(f"Normalized URL: {normalized}")
        print(f"Status:         {task.get('status')}")
        print(f"Created At:     {task.get('created_at')}")
        
        # Check output scripts
        try:
            outputs = client.get_task_outputs(tid)
            script_output = next((o for o in outputs if o['kind'] == 'script' and o['status'] == 'completed'), None)
            has_script = script_output is not None
            script_len = len(script_output['content']) if script_output and script_output.get('content') else 0
            print(f"Has Valid Script: {has_script} (Len: {script_len})")
        except Exception as e:
            print(f"Error fetching outputs: {e}")
            has_script = False

        tasks_data.append({
            "id": tid,
            "url": video_url,
            "norm_url": normalized,
            "created_at": task.get('created_at'),
            "has_script": has_script
        })
        
        # Simulate Cache Check
        print("\n[Cache Check Simulation]")
        try:
            # Same query as in workflow.py check_cache
            found_task = client.find_latest_task_with_valid_script(normalized) or client.find_latest_task_with_valid_script(video_url)
            
            if found_task:
                print(f"  -> Would Hit Cache: YES")
                print(f"  -> Found Task ID: {found_task['id']}")
                print(f"  -> Found Task URL: {found_task['video_url']}")
                print(f"  -> Found Task Created At: {found_task['created_at']}")
                
                if found_task['id'] == tid:
                    print("  -> (Self-match warning: The found task is the task itself. This is expected if looking up an existing completed task.)")
            else:
                print(f"  -> Would Hit Cache: NO")
        except Exception as e:
            print(f"Error in cache simulation: {e}")

    # Compare pair if exactly 2
    if len(tasks_data) == 2:
        print("\n--- Comparison ---")
        t1, t2 = tasks_data[0], tasks_data[1]
        print(f"URLs Match: {t1['url'] == t2['url']}")
        print(f"Normalized Match: {t1['norm_url'] == t2['norm_url']}")
        
        if t1['norm_url'] != t2['norm_url']:
            print("REASON: Normalized URLs are different.")

        elif t1['norm_url'] == t2['norm_url']:
            print("REASON: Normalized URLs match. Cache miss might be due to timing or script availability.")
            # Check timing
            t1_created_str = t1['created_at']
            t2_created_str = t2['created_at']
            
            if t1_created_str and t2_created_str:
                t1_created = datetime.datetime.fromisoformat(t1_created_str)
                t2_created = datetime.datetime.fromisoformat(t2_created_str)

                # Sort by creation time
                if t1_created < t2_created:
                    first, second = t1, t2
                    first_created, second_created = t1_created, t2_created
                else:
                    first, second = t2, t1
                    first_created, second_created = t2_created, t1_created
                
                print(f"First Task: {first['id']} (Created: {first['created_at']})")
                
                # Fetch script completion time for the first task
                try:
                    out_1 = client.get_task_outputs(first['id'])
                    script_1 = next((o for o in out_1 if o['kind'] == 'script' and o['status'] == 'completed'), None)
                    
                    if script_1:
                        s1_updated_str = script_1['updated_at']
                        s1_updated = datetime.datetime.fromisoformat(s1_updated_str)
                        print(f"First Task Script Completed At: {s1_updated}")
                        print(f"Second Task Created At:         {second['created_at']}")
                        
                        if s1_updated > second_created:
                            print("CONCLUSION: CACHE MISS EXPLAINED.")
                            print("The script for the first task finished AFTER the second task started.")
                            print(f"Delay: {s1_updated - second_created}")
                        else:
                            print("CONCLUSION: TIMING LOOKS OK, SHOULD HAVE HIT CACHE.")
                            print(f"Gap: {second_created - s1_updated}")
                            # Check if valid content
                            if len(script_1.get('content', '')) == 0:
                                print("BUT content length is 0!")
                    else:
                        print("CONCLUSION: CACHE MISS EXPLAINED. First task had no completed script.")
                
                except Exception as e:
                    print(f"Error checking script details: {e}")


if __name__ == "__main__":
    main()
