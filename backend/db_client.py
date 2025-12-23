import os
import logging
from typing import Dict, Any, List, Optional
from supabase import create_client, Client

# Configure logging
logger = logging.getLogger(__name__)

class DBClient:
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("SUPABASE_SERVICE_KEY")
        
        if not self.url or not self.key:
            logger.warning("Supabase credentials not found in environment variables. DB operations will fail.")
            self.supabase: Optional[Client] = None
        else:
            try:
                self.supabase = create_client(self.url, self.key)
                logger.info("Supabase client initialized successfully (Service Role).")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.supabase = None

    def create_task(self, user_id: str, video_url: str, video_title: str = None) -> Dict[str, Any]:
        """Create a new task row."""
        if not self.supabase:
            raise Exception("Database client not initialized")
            
        data = {
            "user_id": user_id,
            "video_url": video_url,
            "status": "pending",
            "progress": 0
        }
        
        if video_title:
            data["video_title"] = video_title
        
        response = self.supabase.table("tasks").insert(data).execute()
        return response.data[0]



    def create_task_output(self, task_id: str, user_id: str, kind: str, locale: str = None) -> Dict[str, Any]:
        """Create a new task_output row."""
        if not self.supabase:
            raise Exception("Database client not initialized")
            
        data = {
            "task_id": task_id,
            "user_id": user_id,
            "kind": kind,
            "locale": locale,
            "status": "pending",
            "progress": 0,
            "attempt": 0
        }
        
        response = self.supabase.table("task_outputs").insert(data).execute()
        return response.data[0]

    def update_task_status(self, task_id: str, status: str = None, progress: int = None, video_title: str = None, thumbnail_url: str = None, error: str = None):
        """Update task status and progress."""
        if not self.supabase:
            return

        data = {}
        if status:
            data["status"] = status
        if progress is not None:
            data["progress"] = progress
        if video_title is not None:
            data["video_title"] = video_title
        if thumbnail_url is not None:
            data["thumbnail_url"] = thumbnail_url
        if error is not None:
            data["error_message"] = error
        
        data["updated_at"] = "now()"
        
        try:
            self.supabase.table("tasks").update(data).eq("id", task_id).execute()
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")

    def update_output_status(self, output_id: str, status: str = None, progress: int = None, content: str = None, error: str = None):
        """Update output status, content, and progress."""
        if not self.supabase:
            return

        data = {}
        if status:
            data["status"] = status
        if progress is not None:
            data["progress"] = progress
        if content is not None:
            data["content"] = content
        if error is not None:
            data["error_message"] = error
            
        data["updated_at"] = "now()"
        
        try:
            self.supabase.table("task_outputs").update(data).eq("id", output_id).execute()
        except Exception as e:
            logger.error(f"Failed to update output {output_id}: {e}")

    def get_task(self, task_id: str) -> Dict[str, Any]:
        """Fetch a task by ID."""
        if not self.supabase:
            raise Exception("Database client not initialized")
            
        response = self.supabase.table("tasks").select("*").eq("id", task_id).execute()
        if not response.data:
            return None
        return response.data[0]

    def get_task_outputs(self, task_id: str) -> List[Dict[str, Any]]:
        """Fetch all outputs for a task."""
        if not self.supabase:
            return []
            
        response = self.supabase.table("task_outputs").select("*").eq("task_id", task_id).execute()
        return response.data
        
    def validate_token(self, token: str) -> Optional[str]:
        """Validate Supabase JWT and return user_id."""
        if not self.supabase:
            return None
        try:
            # Clean "Bearer " prefix if present
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
                
            user = self.supabase.auth.get_user(token)
            if user and user.user:
                return user.user.id
            return None
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None
