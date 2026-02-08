from functools import lru_cache
import os
import logging
from typing import Optional, Dict
from fastapi import Header, HTTPException, Depends
from coinbase_commerce.client import Client as CoinbaseClient

from db_client import DBClient
from config import settings
from services.notifier import Notifier
from services.supadata_client import SupadataClient
from services.summarizer import Summarizer
from services.transcriber import Transcriber
from services.video_processor import VideoProcessor

logger = logging.getLogger(__name__)

# Single source of truth for Guest Trials
GUEST_TRIAL_COUNT: Dict[str, int] = {}

@lru_cache()
def get_db_client() -> DBClient:
    return DBClient()

# ... (rest of standard providers)
@lru_cache()
def get_video_processor() -> VideoProcessor:
    return VideoProcessor()

@lru_cache()
def get_transcriber() -> Transcriber:
    return Transcriber()

@lru_cache()
def get_summarizer() -> Summarizer:
    return Summarizer()

@lru_cache()
def get_notifier() -> Notifier:
    return Notifier()

@lru_cache()
def get_supadata_client() -> SupadataClient:
    return SupadataClient()

@lru_cache()
def get_coinbase_client() -> CoinbaseClient:
    return CoinbaseClient(api_key=settings.COINBASE_API_KEY)

async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
    db: DBClient = Depends(get_db_client)
) -> str:
    """Identify user and enforce Guest Quota immediately."""
    dev_bypass = os.getenv("DEV_AUTH_BYPASS", "").strip().lower() in {"1", "true", "yes"}
    
    if settings.MOCK_MODE:
        return "00000000-0000-0000-0000-000000000001"

    # 1. AUTHENTICATED (Bearer token present)
    if authorization and authorization.startswith("Bearer "):
        user_id = db.validate_token(authorization)
        if user_id:
            return user_id
        raise HTTPException(status_code=401, detail="Invalid Token")

    # 2. GUEST (X-Guest-Id present)
    if x_guest_id:
        count = GUEST_TRIAL_COUNT.get(x_guest_id, 0)
        # Check if quota exceeded BEFORE allowing access
        if not dev_bypass and count >= 1:
            logger.warning(f"Guest Quota Exceeded for {x_guest_id}")
            raise HTTPException(status_code=402, detail="Guest quota exceeded")
        return x_guest_id

    # 3. FALLBACK (No ID provided)
    return "00000000-0000-0000-0000-000000000001"

def increment_guest_usage(guest_id: str):
    """Call this AFTER successful task creation."""
    if guest_id:
        GUEST_TRIAL_COUNT[guest_id] = GUEST_TRIAL_COUNT.get(guest_id, 0) + 1
        logger.info(f"Incremented guest usage for {guest_id}. Total: {GUEST_TRIAL_COUNT[guest_id]}")
