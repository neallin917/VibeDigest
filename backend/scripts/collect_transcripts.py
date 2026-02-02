import os
import sys
import json
import logging
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from utils.env_loader import load_env
load_env()

from db_client import DBClient

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("collect_fixtures")

FIXTURES_DIR = Path("backend/tests/fixtures/transcripts")

def slugify(text: str) -> str:
    import re
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[-\s]+', '_', text).strip('_')

def save_fixture(task_id: str, content: str, metadata: dict):
    # Ensure directory exists
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save transcript
    txt_path = FIXTURES_DIR / f"{task_id}.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    # Save metadata
    json_path = FIXTURES_DIR / f"{task_id}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    logger.info(f"✅ Saved fixture: {task_id} ({metadata.get('title')})")

def collect_from_supabase(limit: int = 10):
    db = DBClient()
    
    # Query to get completed transcripts with task metadata
    query = """
    SELECT 
        o.task_id, 
        o.content, 
        t.video_url, 
        t.video_title,
        t.duration
    FROM task_outputs o
    JOIN tasks t ON o.task_id = t.id
    WHERE o.kind = 'script' 
      AND o.status = 'completed'
      AND t.is_demo = true
      AND t.is_deleted = false
    ORDER BY t.created_at DESC
    LIMIT :limit
    """
    
    try:
        results = db._execute_query(query, {"limit": limit})
        
        if not results:
            logger.warning("No completed transcripts found in database.")
            return

        print(f"\n🔍 Found {len(results)} potential fixtures. Downloading...\n")

        for row in results:
            task_id = row['task_id']
            content = row['content']
            
            metadata = {
                "task_id": str(task_id),
                "title": row.get('video_title') or "Untitled",
                "url": row.get('video_url'),
                "duration": row.get('duration'),
                "slug": slugify(row.get('video_title') or "untitled")
            }
            
            save_fixture(str(task_id), content, metadata)
            
        print(f"\n✨ Successfully collected {len(results)} fixtures in {FIXTURES_DIR}")

    except Exception as e:
        logger.error(f"Failed to collect fixtures: {e}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="从 Supabase 收集真实 Transcript 作为本地测试集")
    parser.add_argument("--limit", type=int, default=10, help="收集的数量限制 (默认: 10)")
    
    args = parser.parse_args()
    collect_from_supabase(limit=args.limit)
