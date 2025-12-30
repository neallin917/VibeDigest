import os
import logging
from typing import Dict, Any, List, Optional
from supabase import create_client, Client

# Configure logging
logger = logging.getLogger(__name__)

# Pricing Constants
FREE_LIMIT = 3
PRO_LIMIT = 100

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
                # SECURITY WARNING: This client uses the SERVICE_KEY which bypasses RLS.
                # All operations using this client must strictly validate user ownership/permissions
                # at the application level (e.g. valid_token check, user_id consistency).
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

    def get_output(self, output_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a task_output by ID."""
        if not self.supabase:
            return None
        try:
            response = self.supabase.table("task_outputs").select("*").eq("id", output_id).execute()
            if not response.data:
                return None
            return response.data[0]
        except Exception as e:
            logger.error(f"Failed to fetch output {output_id}: {e}")
            return None

    def get_task_outputs(self, task_id: str) -> List[Dict[str, Any]]:
        """Fetch all outputs for a task."""
        if not self.supabase:
            return []
            
        response = self.supabase.table("task_outputs").select("*").eq("task_id", task_id).execute()
        return response.data

    def find_latest_completed_task_by_url(self, video_url: str) -> Optional[Dict[str, Any]]:
        """
        Find the most recent completed task with the same video_url.
        Used for deduplication/caching.
        """
        if not self.supabase:
            return None
        
        try:
            # We want a task that is completed (status='completed')
            # ordered by created_at desc to get the freshest one.
            response = self.supabase.table("tasks") \
                .select("*") \
                .eq("video_url", video_url) \
                .eq("status", "completed") \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()
            
            if response.data:
                return response.data[0]
            return None
        except Exception as e:
            logger.error(f"Failed to search for duplicate task: {e}")
            return None

    def create_completed_task_output(self, task_id: str, user_id: str, kind: str, content: str, locale: str = None, raw_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Create a new task_output row that is already completed (for caching)."""
        if not self.supabase:
            raise Exception("Database client not initialized")
            
        data = {
            "task_id": task_id,
            "user_id": user_id,
            "kind": kind,
            "locale": locale,
            "status": "completed",
            "progress": 100,
            "content": content,
            "attempt": 0
        }
        # If we want to store extra metadata? usually content is the big JSON/Text
        
        response = self.supabase.table("task_outputs").insert(data).execute()
        return response.data[0]
        
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

    def get_profile(self, user_id: str) -> Dict[str, Any]:
        """Fetch user profile including credits and tier."""
        if not self.supabase:
            return None
        response = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not response.data:
            # Create default profile if missing (Should be handled by trigger, but failsafe)
            try:
                data = {"id": user_id, "tier": "free", "usage_limit": 3}
                self.supabase.table("profiles").insert(data).execute()
                return data
            except Exception as e:
                logger.error(f"Failed to create profile: {e}")
                return None
        return response.data[0]

    def check_and_consume_quota(self, user_id: str) -> bool:
        """
        Check if user has quota or credits. If yes, consume 1 and return True.
        Priority:
        1. Monthly usage (if usage_count < usage_limit)
        2. Extra credits (if extra_credits > 0)
        """
        if not self.supabase:
            return False

        profile = self.get_profile(user_id)
        if not profile:
            return False

        usage = profile.get("usage_count", 0)
        limit = profile.get("usage_limit", 3)
        extra = profile.get("extra_credits", 0)

        # 1. Check Monthly Quota
        if usage < limit:
            try:
                self.supabase.table("profiles").update({"usage_count": usage + 1}).eq("id", user_id).execute()
                return True
            except Exception as e:
                logger.error(f"Failed to update usage: {e}")
                return False

        # 2. Check Extra Credits
        if extra > 0:
            try:
                self.supabase.table("profiles").update({"extra_credits": extra - 1}).eq("id", user_id).execute()
                return True
            except Exception as e:
                logger.error(f"Failed to update extra credits: {e}")
                return False

        return False

    def add_credits(self, user_id: str, amount: int):
        """Add one-time credits to a user."""
        if not self.supabase:
            return
        
        # We need atomic update, but supabase-py simplistic. 
        # Using rpc would be better, but for now read-modify-write.
        profile = self.get_profile(user_id)
        if not profile:
            return
            
        new_credits = profile.get("extra_credits", 0) + amount
        self.supabase.table("profiles").update({"extra_credits": new_credits}).eq("id", user_id).execute()

    def update_subscription(self, stripe_customer_id: str, tier: str, period_end: str):
        """Update subscription status from Stripe Webhook."""
        if not self.supabase:
            return

        # Map tier to limit
        limit = 100 if tier == 'pro' else 3
        
        data = {
            "tier": tier,
            "usage_limit": limit,
            "usage_count": 0, # Reset usage on new period
            "period_end": period_end
        }
        
        self.supabase.table("profiles").update(data).eq("stripe_customer_id", stripe_customer_id).execute()
        
    def link_stripe_customer(self, user_id: str, stripe_customer_id: str):
        """Link a Stripe Customer ID to a user."""
        if not self.supabase:
            return
        self.supabase.table("profiles").update({"stripe_customer_id": stripe_customer_id}).eq("id", user_id).execute()

    # -------------------------------------------------------------------------
    # Payment / Order Methods (Unified)
    # -------------------------------------------------------------------------
    def create_payment_order(self, user_id: str, provider: str, amount_fiat: float, currency_fiat: str = "USD") -> Dict[str, Any]:
        """Create a new payment order."""
        if not self.supabase:
            return None
        
        data = {
            "user_id": user_id,
            "provider": provider,
            "amount_fiat": amount_fiat,
            "currency_fiat": currency_fiat,
            "status": "pending"
        }
        res = self.supabase.table("payment_orders").insert(data).execute()
        return res.data[0] if res.data else None

    def update_payment_order(self, order_id: str, provider_payment_id: str = None, status: str = None, amount_crypto: float = None, currency_crypto: str = None, metadata: Dict = None):
        """Update payment order details."""
        if not self.supabase:
            return
        
        data = {}
        if provider_payment_id: data["provider_payment_id"] = provider_payment_id
        if status: data["status"] = status
        if amount_crypto is not None: data["amount_crypto"] = amount_crypto
        if currency_crypto: data["currency_crypto"] = currency_crypto
        if metadata: data["metadata"] = metadata
        
        data["updated_at"] = "now()"
        
        self.supabase.table("payment_orders").update(data).eq("id", order_id).execute()

    def get_payment_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        """Get payment order by ID."""
        if not self.supabase:
            return None
        res = self.supabase.table("payment_orders").select("*").eq("id", order_id).execute()
        return res.data[0] if res.data else None
    
    def get_payment_order_by_provider_id(self, provider_payment_id: str) -> Optional[Dict[str, Any]]:
        """Get payment order by provider's ID (session_id or charge_code)."""
        if not self.supabase:
            return None
        res = self.supabase.table("payment_orders").select("*").eq("provider_payment_id", provider_payment_id).execute()
        return res.data[0] if res.data else None
