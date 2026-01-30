import os
import logging
import re
import asyncio
from typing import Optional, Any, List, AsyncIterator

from config import settings
from langchain_community.chat_models import ChatLiteLLM
from langchain_core.outputs import ChatGenerationChunk

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


class RateLimitAwareChatLiteLLM(ChatLiteLLM):
    """
    Custom wrapper around ChatLiteLLM that parses 'Please wait X seconds'
    error messages and automatically retries after sleeping.
    """

    async def _astream(
        self,
        messages: List[Any],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any,
    ) -> AsyncIterator[ChatGenerationChunk]:
        # Retry loop parameters
        max_retries = 3
        current_attempt = 0

        while True:
            yielded_any = False
            try:
                # Call parent method
                async for chunk in super()._astream(messages, stop, run_manager, **kwargs):
                    yield chunk
                    yielded_any = True
                return
            except Exception as e:
                if yielded_any:
                    raise e

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
    Creates a LangChain Chat Model using LiteLLM.
    Unified factory for all providers.
    """
    import litellm

    # Resolve temperature if not provided
    if temperature is None:
        temperature = settings.get_temperature(model_name)

    litellm.drop_params = True # Fix for gpt-5 or other provider unsupported params

    # Use our RateLimitAware wrapper
    return RateLimitAwareChatLiteLLM(
        model=model_name,
        temperature=temperature,
        **kwargs
    )


async def ainvoke_structured_json(
    llm: Any,
    schema: Any,
    messages: List[Any],
    *,
    config: Optional[dict] = None,
) -> dict:
    """
    Invoke a structured-output LLM, with graceful fallback to parsing JSON text
    when tool-calling is not supported or returns None.
    
    This is a shared utility to avoid code duplication across services.
    
    Args:
        llm: The LangChain chat model instance
        schema: A Pydantic model class for structured output
        messages: List of LangChain message objects
        config: Optional LangChain config dict for tracing
        
    Returns:
        A dictionary representation of the parsed schema
        
    Raises:
        ValueError: If the result cannot be parsed into the expected format
        json.JSONDecodeError: If JSON parsing fails
    """
    import json
    from utils.text_utils import extract_first_json_object
    
    structured_llm = llm.with_structured_output(schema)
    result = await structured_llm.ainvoke(messages, config=config)

    if result is None:
        # Fallback: invoke without structured output and parse JSON manually
        raw = await llm.ainvoke(messages, config=config)
        raw_text = getattr(raw, "content", None) or str(raw)
        json_text = extract_first_json_object(raw_text) or raw_text
        obj = json.loads(json_text)
        parsed = schema(**obj)
        if hasattr(parsed, "model_dump"):
            return parsed.model_dump()
        return parsed.dict()

    if hasattr(result, "model_dump"):
        return result.model_dump()
    if hasattr(result, "dict"):
        return result.dict()
    if isinstance(result, dict):
        return result
    if isinstance(result, str):
        obj = json.loads(result)
        parsed = schema(**obj)
        if hasattr(parsed, "model_dump"):
            return parsed.model_dump()
        return parsed.dict()

    raise ValueError(f"Unexpected structured output type: {type(result)!r}")
