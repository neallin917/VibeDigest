import os
import sys
import argparse
import json
from dotenv import load_dotenv, find_dotenv

# Import supabase first to ensure we load the library, not the local folder
try:
    import supabase
except ImportError:
    pass

# Load environment variables from .env.local and .env
# This allows running the script without manually exporting DATABASE_URL
load_dotenv(find_dotenv('.env.local'))
load_dotenv(find_dotenv('.env'))

# Add the project root to the python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.db_client import DBClient

def main():
    parser = argparse.ArgumentParser(description="Query task outputs by Task ID")
    parser.add_argument("task_id", help="The Task ID to query")
    args = parser.parse_args()

    print(f"Querying outputs for task_id: {args.task_id}")

    try:
        # Check if DATABASE_URL is set
        if not os.environ.get("DATABASE_URL"):
             print("Please set DATABASE_URL environment variable.")
             return

        client = DBClient()
        outputs = client.get_task_outputs(args.task_id, include_content=True)
        
        if not outputs:
            print("No outputs found for this task.")
        else:
            print(f"Found {len(outputs)} outputs:")
            for output in outputs:
                print("-" * 40)
                print(f"ID: {output.get('id')}")
                print(f"Kind: {output.get('kind')}")
                print(f"Locale: {output.get('locale')}")
                print(f"Status: {output.get('status')}")
                
                content = output.get('content')
                print("Content:")
                if isinstance(content, (dict, list)):
                    try:
                        print(json.dumps(content, ensure_ascii=False, indent=2))
                    except:
                        print(content)
                else:
                    print(content)
                print("-" * 40)

    except Exception as e:
        print(f"Error querying task outputs: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
