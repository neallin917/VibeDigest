from functools import lru_cache
from typing import Optional
from fastapi import Header, HTTPException, Depends
from coinbase_commerce.client import Client as CoinbaseClient

from db_client import DBClient
from config import settings
from notifier import Notifier
from supadata_client import SupadataClient
from summarizer import Summarizer
from transcriber import Transcriber
from translator import Translator
from video_processor import VideoProcessor

# Service Providers using lru_cache to act as singletons within the request scope context
# (though lru_cache makes them global singletons effectively)

@lru_cache()
def get_db_client() -> DBClient:
    return DBClient()

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
def get_translator() -> Translator:
    return Translator()

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
    db: DBClient = Depends(get_db_client)
) -> str:
    """Validate Bearer token and return user_id."""
    if settings.MOCK_MODE:
        return "00000000-0000-0000-0000-000000000001"

    if not authorization:
        # For Dev/Testing ease: allow anonymous if no header (Mock UUID)
        return "00000000-0000-0000-0000-000000000001"

    user_id = db.validate_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")
    return user_id
