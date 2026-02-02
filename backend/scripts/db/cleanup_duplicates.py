import os
import sys
import logging
from typing import List, Dict, Any

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from utils.env_loader import load_env
load_env()

from db_client import DBClient

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleanup_tasks")

def cleanup_duplicates(dry_run: bool = True):
    db = DBClient()
    
    # 1. Find duplicate groups (user_id, video_url)
    # We only care about tasks that aren't already deleted
    query_find_dupes = """
    SELECT user_id, video_url, count(*) as count
    FROM tasks
    WHERE is_deleted = false
    GROUP BY user_id, video_url
    HAVING count(*) > 1
    """
    
    dupe_groups = db._execute_query(query_find_dupes)
    
    if not dupe_groups:
        print("✅ 没有发现重复的任务（基于 user_id 和 video_url）。")
        return

    print(f"🔍 发现 {len(dupe_groups)} 组重复任务。")
    if dry_run:
        print("🧪 [DRY RUN] 正在模拟清理...\n")
    else:
        print("🚀 正在执行清理...\n")

    total_deleted = 0

    for group in dupe_groups:
        user_id = group['user_id']
        url = group['video_url']
        
        # 2. Get all tasks for this group, ranked by status and age
        # We prefer 'completed' status, then the most recently updated/created
        query_get_tasks = """
        SELECT id, status, created_at, video_title
        FROM tasks
        WHERE user_id = :uid AND video_url = :url AND is_deleted = false
        ORDER BY 
            CASE WHEN status = 'completed' THEN 0 ELSE 1 END ASC,
            created_at DESC
        """
        tasks = db._execute_query(query_get_tasks, {"uid": user_id, "url": url})
        
        if len(tasks) <= 1:
            continue
            
        # Keep the first one
        to_keep = tasks[0]
        to_delete = tasks[1:]
        
        print(f"🎬 视频: {to_keep.get('video_title', 'Untitled')} ({url[:40]}...)")
        print(f"   ✅ 保留: {to_keep['id']} (状态: {to_keep['status']}, 创建于: {to_keep['created_at']})")
        
        delete_ids = [t['id'] for t in to_delete]
        for t in to_delete:
            print(f"   🗑️  标记删除: {t['id']} (状态: {t['status']}, 创建于: {t['created_at']})")
        
        if not dry_run:
            # Execute soft delete
            update_query = "UPDATE tasks SET is_deleted = true, updated_at = now() WHERE id = ANY(:ids)"
            db._execute_query(update_query, {"ids": delete_ids})
        
        total_deleted += len(delete_ids)
        print("-" * 40)

    print(f"\n✨ {'模拟' if dry_run else '执行'}完成！")
    print(f"📊 共计标记删除 {total_deleted} 条重复任务。")
    if dry_run:
        print("\n💡 提示: 确认无误后，运行: uv run backend/scripts/cleanup_duplicates.py --confirm")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="清理 Supabase 数据库中的重复任务 (Soft Delete)")
    parser.add_argument("--confirm", action="store_true", help="确认执行清理 (默认仅 Dry Run)")
    
    args = parser.parse_args()
    cleanup_duplicates(dry_run=not args.confirm)
