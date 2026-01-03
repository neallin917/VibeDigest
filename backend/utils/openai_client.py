import os
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# Langfuse v3: Use langfuse.openai wrapper for automatic tracing
try:
    from langfuse.openai import OpenAI as LangfuseOpenAI
    HAS_LANGFUSE = True
except ImportError as e:
    logger.warning(f"Langfuse Import Failed: {e}")
    HAS_LANGFUSE = False
    from openai import OpenAI as LangfuseOpenAI  # Fallback to standard

def get_openai_client(base_url: Optional[str] = None):
    """
    Factory to get an OpenAI client.
    Uses Langfuse-wrapped client if available for automatic tracing.
    Trace attributes (session_id, user_id, tags) are propagated via
    propagate_attributes() in the calling context.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set in environment.")
        return None
        
    final_base_url = base_url or os.getenv("OPENAI_BASE_URL")
    
    # Always use Langfuse wrapper - it handles unconfigured state gracefully
    if final_base_url:
        return LangfuseOpenAI(api_key=api_key, base_url=final_base_url)
    return LangfuseOpenAI(api_key=api_key)
