import os
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

# Check for Langfuse
try:
    from langfuse.openai import OpenAI as LangfuseOpenAI
    HAS_LANGFUSE = True
except ImportError:
    HAS_LANGFUSE = False
    
from openai import OpenAI

def get_openai_client(base_url: Optional[str] = None):
    """
    Factory to get an OpenAI client (wrapped with Langfuse if available).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.warning("OPENAI_API_KEY not set in environment.")
        return None
        
    final_base_url = base_url or os.getenv("OPENAI_BASE_URL")
    
    # Use Langfuse wrapper if secret keys exist
    if HAS_LANGFUSE and settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
        if final_base_url:
            return LangfuseOpenAI(api_key=api_key, base_url=final_base_url)
        return LangfuseOpenAI(api_key=api_key)
        
    # Standard Client
    if final_base_url:
        return OpenAI(api_key=api_key, base_url=final_base_url)
    return OpenAI(api_key=api_key)
