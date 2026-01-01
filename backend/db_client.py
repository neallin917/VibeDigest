import os
import logging
from typing import Dict, Any, List, Optional
from supabase import create_client, Client
from sqlalchemy import create_engine, text, exc
from sqlalchemy.orm import sessionmaker, scoped_session
import json

# Configure logging
logger = logging.getLogger(__name__)

# Pricing Constants
FREE_LIMIT = 3
PRO_LIMIT = 100

class DBClient:
    def __init__(self):
        # 1. Supabase Client (For Auth Validation ONLY)
        self.url = os.environ.get("SUPABASE_URL")
        self.key = os.environ.get("SUPABASE_SERVICE_KEY")
        
        if not self.url or not self.key:
            logger.warning("Supabase credentials not found. Auth validation will fail.")
            self.supabase: Optional[Client] = None
        else:
            try:
                self.supabase = create_client(self.url, self.key)
                logger.info("Supabase client initialized (Auth Only).")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                self.supabase = None

        # 2. SQLAlchemy Engine (For Data Operations)
        # In production/dev, this should be the Supabase Transaction Pooler (port 6543) or Session Pooler (5432)
        # Format: postgresql://postgres.project:password@aws-0-region.pooler.supabase.com:6543/postgres
        self.db_url = os.environ.get("DATABASE_URL")
        
        if self.db_url:
            try:
                self.engine = create_engine(self.db_url, pool_pre_ping=True, pool_size=10, max_overflow=20)
                self.Session = scoped_session(sessionmaker(bind=self.engine))
                logger.info("SQLAlchemy engine initialized.")
            except Exception as e:
                logger.error(f"Failed to initialize SQLAlchemy engine: {e}")
                self.engine = None
        else:
            logger.warning("DATABASE_URL not set. Data operations will fail.")
            self.engine = None

    def _execute_query(self, query_str: str, params: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Helper to execute safe parameterized queries."""
        if not self.engine:
            raise Exception("Database engine not initialized")
        
        session = self.Session()
        try:
            result = session.execute(text(query_str), params or {})
            session.commit()
            
            # Try to return dicts if it's a SELECT or RETURNING
            if result.returns_rows:
                return [dict(row._mapping) for row in result]
            return []
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def create_task(self, user_id: str, video_url: str, video_title: str = None) -> Dict[str, Any]:
        """Create a new task row."""
        query = """
            INSERT INTO tasks (user_id, video_url, status, progress, video_title)
            VALUES (:user_id, :video_url, 'pending', 0, :video_title)
            RETURNING *;
        """
        rows = self._execute_query(query, {
            "user_id": user_id,
            "video_url": video_url,
            "video_title": video_title
        })
        return rows[0] if rows else None

    def create_task_output(self, task_id: str, user_id: str, kind: str, locale: str = None) -> Dict[str, Any]:
        """Create a new task_output row."""
        query = """
            INSERT INTO task_outputs (task_id, user_id, kind, locale, status, progress, attempt)
            VALUES (:task_id, :user_id, :kind, :locale, 'pending', 0, 0)
            RETURNING *;
        """
        rows = self._execute_query(query, {
            "task_id": task_id,
            "user_id": user_id,
            "kind": kind,
            "locale": locale
        })
        return rows[0] if rows else None

    def update_task_status(self, task_id: str, status: str = None, progress: int = None, video_title: str = None, thumbnail_url: str = None, error: str = None, **kwargs):
        """Update task status and progress."""
        fields = []
        params = {"task_id": task_id}
        
        if status:
            fields.append("status = :status")
            params["status"] = status
        if progress is not None:
            fields.append("progress = :progress")
            params["progress"] = progress
        if video_title is not None:
            fields.append("video_title = :video_title")
            params["video_title"] = video_title
        if thumbnail_url is not None:
            fields.append("thumbnail_url = :thumbnail_url")
            params["thumbnail_url"] = thumbnail_url
        if error is not None:
            fields.append("error_message = :error")
            params["error"] = error
            
        # Metadata fields
        meta_mapping = {
            "author": "author", "author_url": "author_url", 
            "author_image_url": "author_image_url", "description": "description",
            "keywords": "keywords", "view_count": "view_count",
            "upload_date": "upload_date", "duration": "duration"
        }
        for k, col in meta_mapping.items():
            if kwargs.get(k) is not None:
                val = kwargs.get(k)
                if k == "duration":
                    try: val = int(float(val))
                    except: val = 0
                fields.append(f"{col} = :{k}")
                params[k] = val

        if not fields:
            return

        fields.append("updated_at = now()")
        query = f"UPDATE tasks SET {', '.join(fields)} WHERE id = :task_id"
        
        try:
            self._execute_query(query, params)
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")

    def update_output_status(self, output_id: str, status: str = None, progress: int = None, content: str = None, error: str = None):
        """Update output status, content, and progress."""
        fields = []
        params = {"output_id": output_id}
        
        if status:
            fields.append("status = :status")
            params["status"] = status
        if progress is not None:
            fields.append("progress = :progress")
            params["progress"] = progress
        if content is not None:
            fields.append("content = :content")
            params["content"] = content
        if error is not None:
            fields.append("error_message = :error")
            params["error"] = error
            
        fields.append("updated_at = now()")
        query = f"UPDATE task_outputs SET {', '.join(fields)} WHERE id = :output_id"
        
        try:
            self._execute_query(query, params)
        except Exception as e:
            logger.error(f"Failed to update output {output_id}: {e}")

    def get_task(self, task_id: str) -> Dict[str, Any]:
        """Fetch a task by ID."""
        query = "SELECT * FROM tasks WHERE id = :task_id"
        rows = self._execute_query(query, {"task_id": task_id})
        return rows[0] if rows else None

    def get_output(self, output_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a task_output by ID."""
        query = "SELECT * FROM task_outputs WHERE id = :output_id"
        rows = self._execute_query(query, {"output_id": output_id})
        return rows[0] if rows else None

    def get_task_outputs(self, task_id: str) -> List[Dict[str, Any]]:
        """Fetch all outputs for a task."""
        query = "SELECT * FROM task_outputs WHERE task_id = :task_id"
        return self._execute_query(query, {"task_id": task_id})

    def find_latest_completed_task_by_url(self, video_url: str) -> Optional[Dict[str, Any]]:
        """Find the most recent completed task with the same video_url."""
        query = """
            SELECT * FROM tasks 
            WHERE video_url = :video_url AND status = 'completed'
            ORDER BY created_at DESC LIMIT 1
        """
        rows = self._execute_query(query, {"video_url": video_url})
        return rows[0] if rows else None

    def create_completed_task_output(self, task_id: str, user_id: str, kind: str, content: str, locale: str = None, raw_data: Optional[Dict] = None) -> Dict[str, Any]:
        """Create a new task_output row that is already completed (for caching)."""
        query = """
            INSERT INTO task_outputs (task_id, user_id, kind, locale, status, progress, content, attempt)
            VALUES (:task_id, :user_id, :kind, :locale, 'completed', 100, :content, 0)
            RETURNING *;
        """
        rows = self._execute_query(query, {
            "task_id": task_id,
            "user_id": user_id,
            "kind": kind,
            "locale": locale,
            "content": content
        })
        return rows[0] if rows else None

    def validate_token(self, token: str) -> Optional[str]:
        """Validate Supabase JWT and return user_id."""
        # Use Supabase Client as usual for Auth
        if not self.supabase:
            return None
        try:
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
        query = "SELECT * FROM profiles WHERE id = :user_id"
        rows = self._execute_query(query, {"user_id": user_id})
        
        if not rows:
            # Create default profile if missing
            try:
                # Assuming trigger fails or we are in a test env without triggers
                insert_q = """
                    INSERT INTO profiles (id, tier, usage_limit)
                    VALUES (:id, 'free', 3)
                    RETURNING *;
                """
                rows = self._execute_query(insert_q, {"id": user_id})
                return rows[0] if rows else None
            except Exception as e:
                logger.error(f"Failed to create profile: {e}")
                return None
        return rows[0]

    def check_and_consume_quota(self, user_id: str) -> bool:
        """
        Check if user has quota or credits. If yes, consume 1 and return True.
        """
        profile = self.get_profile(user_id)
        if not profile:
            return False

        usage = profile.get("usage_count", 0)
        limit = profile.get("usage_limit", 3)
        extra = profile.get("extra_credits", 0)

        # 1. Check Monthly Quota
        if usage < limit:
            update_q = "UPDATE profiles SET usage_count = usage_count + 1 WHERE id = :id"
            try:
                self._execute_query(update_q, {"id": user_id})
                return True
            except Exception as e:
                logger.error(f"Failed to update usage: {e}")
                return False

        # 2. Check Extra Credits
        if extra > 0:
            update_q = "UPDATE profiles SET extra_credits = extra_credits - 1 WHERE id = :id"
            try:
                self._execute_query(update_q, {"id": user_id})
                return True
            except Exception as e:
                logger.error(f"Failed to update extra credits: {e}")
                return False

        return False

    def add_credits(self, user_id: str, amount: int):
        """Add one-time credits to a user."""
        query = "UPDATE profiles SET extra_credits = extra_credits + :amount WHERE id = :id"
        try:
            self._execute_query(query, {"id": user_id, "amount": amount})
        except Exception as e:
            logger.error(f"Failed to add credits: {e}")

    def update_subscription(self, creem_customer_id: str, tier: str, period_end: str):
        """Update subscription status from Creem Webhook (by customer id)."""
        limit = 100 if tier == 'pro' else 3
        query = """
            UPDATE profiles 
            SET tier = :tier, usage_limit = :limit, usage_count = 0, period_end = :period_end
            WHERE creem_customer_id = :cid
        """
        try:
            self._execute_query(query, {
                "tier": tier, "limit": limit, "period_end": period_end, "cid": creem_customer_id
            })
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")

    def update_subscription_by_user(self, user_id: str, tier: str, period_end: str):
        """Update subscription status by user_id (for first-time subscriptions)."""
        limit = 100 if tier == 'pro' else 3
        query = """
            UPDATE profiles 
            SET tier = :tier, usage_limit = :limit, usage_count = 0, period_end = :period_end
            WHERE id = :uid
        """
        try:
            self._execute_query(query, {
                "tier": tier, "limit": limit, "period_end": period_end, "uid": user_id
            })
        except Exception as e:
            logger.error(f"Failed to update subscription by user: {e}")

    def link_creem_customer(self, user_id: str, creem_customer_id: str):
        """Link a Creem Customer ID to a user."""
        query = "UPDATE profiles SET creem_customer_id = :cid WHERE id = :uid"
        try:
            self._execute_query(query, {"cid": creem_customer_id, "uid": user_id})
        except Exception as e:
            logger.error(f"Failed to link creem customer: {e}")

    # -------------------------------------------------------------------------
    # Payment / Order Methods (Unified)
    # -------------------------------------------------------------------------
    def create_payment_order(self, user_id: str, provider: str, amount_fiat: float, currency_fiat: str = "USD") -> Dict[str, Any]:
        """Create a new payment order."""
        query = """
            INSERT INTO payment_orders (user_id, provider, amount_fiat, currency_fiat, status)
            VALUES (:uid, :prov, :amt, :curr, 'pending')
            RETURNING *;
        """
        rows = self._execute_query(query, {
            "uid": user_id, "prov": provider, "amt": amount_fiat, "curr": currency_fiat
        })
        return rows[0] if rows else None

    def update_payment_order(self, order_id: str, provider_payment_id: str = None, status: str = None, amount_crypto: float = None, currency_crypto: str = None, metadata: Dict = None):
        """Update payment order details."""
        fields = []
        params = {"oid": order_id}
        
        if provider_payment_id:
            fields.append("provider_payment_id = :pid")
            params["pid"] = provider_payment_id
        if status:
            fields.append("status = :status")
            params["status"] = status
        if amount_crypto is not None:
            fields.append("amount_crypto = :ac")
            params["ac"] = amount_crypto
        if currency_crypto:
            fields.append("currency_crypto = :cc")
            params["cc"] = currency_crypto
        if metadata:
            fields.append("metadata = :meta")
            params["meta"] = json.dumps(metadata)
            
        if not fields: return
        fields.append("updated_at = now()")
        
        query = f"UPDATE payment_orders SET {', '.join(fields)} WHERE id = :oid"
        try:
            self._execute_query(query, params)
        except Exception as e:
            logger.error(f"Failed to update payment order: {e}")

    def get_payment_order(self, order_id: str) -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM payment_orders WHERE id = :oid"
        rows = self._execute_query(query, {"oid": order_id})
        return rows[0] if rows else None
    
    def get_payment_order_by_provider_id(self, provider_payment_id: str) -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM payment_orders WHERE provider_payment_id = :pid"
        rows = self._execute_query(query, {"pid": provider_payment_id})
        return rows[0] if rows else None
