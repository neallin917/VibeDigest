import os
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

from typing import Optional, Any

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

def get_openai_client(base_url: Optional[str] = None) -> Any:
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

def get_async_openai_client(base_url: Optional[str] = None) -> Any:
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


# Factory for LangChain Chat Models
def create_chat_model(model_name: str, temperature: Optional[float] = None, **kwargs: Any) -> Any:
    """
    Creates a LangChain Chat Model based on LLM_PROVIDER.
    Supports 'openai' (default) and 'custom'/'litellm'.
    """
    from langchain_litellm import ChatLiteLLM
    from langchain_openai import ChatOpenAI
    
    # Resolve temperature if not provided
    if temperature is None:
        temperature = settings.get_temperature(model_name)
    
    # 1. LiteLLM Logic (Preferred for switching)
    # If using LiteLLM provider OR if model name implies a provider (e.g. "ollama/...")
    use_litellm = settings.LLM_PROVIDER != "openai" or "/" in model_name
    
    if use_litellm:
        import litellm
        litellm.drop_params = True # Fix for gpt-5 unsupported params
        
        # LiteLLM handles API Key / Base URL lookup internally via os.environ usually.
        # But we can pass explicitly if needed.
        # Ensure we map config aliases if passed model is a raw alias key? 
        # No, caller should pass resolved model name (e.g. MODEL_ALIAS_GPT_4O).
        
        # Note: ChatLiteLLM expects parameters compatible with LiteLLM.
        # It doesn't strictly need api_key provided if env vars are set.

        # Use our RateLimitAware wrapper instead of standard ChatLiteLLM
        return RateLimitAwareChatLiteLLM(
            model=model_name,
            temperature=temperature,
            **kwargs
        )

    # 2. Standard OpenAI Fallback
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")

    from pydantic import SecretStr

    return ChatOpenAI(
        model=model_name,
        api_key=SecretStr(api_key) if api_key else None,
        base_url=base_url,
        temperature=temperature,
        **kwargs
    )


import re
import asyncio
from langchain_litellm import ChatLiteLLM
from typing import List, Optional, Any

class RateLimitAwareChatLiteLLM(ChatLiteLLM):
    """
    Custom wrapper around ChatLiteLLM that parses 'Please wait X seconds'
    error messages and automatically retries after sleeping.
    """

    async def _agenerate(
        self,
        messages: List[Any],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> Any:
        # Retry loop parameters
        max_retries = 3
        current_attempt = 0

        while True:
            try:
                # Call parent method
                return await super()._agenerate(messages, stop, run_manager, **kwargs)
            except Exception as e:
                current_attempt += 1
                error_str = str(e)

                # Check for rate limit message
                wait_match = re.search(r"wait (\d+)s", error_str, re.IGNORECASE)

                if wait_match and current_attempt <= max_retries:
                    wait_seconds = int(wait_match.group(1)) + 2  # Add 2s buffer
                    logger.warning(
                        f"Rate limit hit. API requested wait: {wait_seconds}s. "
                        f"Retrying ({current_attempt}/{max_retries})..."
                    )
                    await asyncio.sleep(wait_seconds)
                    continue

                # If no match or retries exhausted, re-raise
                raise e

