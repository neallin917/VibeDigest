import os
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# Langfuse v3: Use langfuse.openai wrapper for automatic tracing
try:
    from langfuse.openai import OpenAI as LangfuseOpenAI
    from langfuse.openai import AsyncOpenAI as LangfuseAsyncOpenAI
    HAS_LANGFUSE = True
except ImportError as e:
    logger.warning(f"Langfuse Import Failed: {e}")
    HAS_LANGFUSE = False
    from openai import OpenAI as LangfuseOpenAI  # Fallback to standard
    from openai import AsyncOpenAI as LangfuseAsyncOpenAI

def get_openai_client(base_url: Optional[str] = None):
    """
    Factory to get an OpenAI client (Synchronous).
    Uses Langfuse-wrapped client if available for automatic tracing.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set in environment.")
        return None
        
    final_base_url = base_url or os.getenv("OPENAI_BASE_URL")
    
    if final_base_url:
        return LangfuseOpenAI(api_key=api_key, base_url=final_base_url)
    return LangfuseOpenAI(api_key=api_key)

def get_async_openai_client(base_url: Optional[str] = None):
    """
    Factory to get an Async OpenAI client.
    Uses Langfuse-wrapped client if available for automatic tracing.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set in environment.")
        return None
        
    final_base_url = base_url or os.getenv("OPENAI_BASE_URL")
    
    if final_base_url:
        return LangfuseAsyncOpenAI(api_key=api_key, base_url=final_base_url)
    return LangfuseAsyncOpenAI(api_key=api_key)
