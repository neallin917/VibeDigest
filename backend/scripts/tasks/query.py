#!/usr/bin/env python3
"""
Query task outputs by Task ID.
Shows status, kind, and content of outputs.
"""

import os
import sys
import argparse
import json

# Setup path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from utils.env_loader import load_env
load_env()

from db_client import DBClient

def main():
    parser = argparse.ArgumentParser(description="Query task outputs")
    parser.add_argument("task_id", help="The Task ID to query")
    args = parser.parse_args()

    print(f"Querying outputs for task_id: {args.task_id}")

    try:
        client = DBClient()
        # Ensure outputs include content
        outputs = client.get_task_outputs(args.task_id, include_content=True)
        
        if not outputs:
            print("No outputs found for this task.")
        else:
            print(f"Found {len(outputs)} outputs:")
            for output in outputs:
                print("-" * 60)
                print(f"ID:     {output.get('id')}")
                print(f"Kind:   {output.get('kind')}")
                print(f"Locale: {output.get('locale')}")
                print(f"Status: {output.get('status')}")
                
                content = output.get('content')
                print("Content:")
                if not content:
                    print("  (Empty)")
                elif isinstance(content, (dict, list)):
                    try:
                        print(json.dumps(content, ensure_ascii=False, indent=2))
                    except:
                        print(content)
                else:
                    # Truncate if too long for display, unless it's JSON-like text
                    s_content = str(content)
                    if len(s_content) > 500:
                         print(f"  {s_content[:500]}...(truncated, total {len(s_content)} chars)")
                    else:
                         print(f"  {s_content}")
                print("-" * 60)

    except Exception as e:
        print(f"Error querying task outputs: {e}")

if __name__ == "__main__":
    main()
