from typing import Any, Dict, Optional

from config import settings
from utils.model_registry import get_model_registry
from utils.openai_client import create_chat_model, ainvoke_structured_json


INTENT_TO_TIER = {
    "chat": "smart",
    "comprehension": "smart",
    "summary": "fast",
    "translation": "fast",
    "guard": "fast",
    "helper": "fast",
}


def resolve_model_for_intent(intent: str, provider: Optional[str] = None) -> Optional[str]:
    tier = INTENT_TO_TIER.get(intent, "smart")
    registry = get_model_registry()
    provider_name = provider or settings.LLM_PROVIDER
    provider_cfg = registry.get_provider(provider_name)
    if not provider_cfg:
        return None
    defaults = provider_cfg.get("defaults") or {}
    return defaults.get(tier)


def create_chat_model_for_intent(
    intent: str,
    *,
    model_name: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    model_kwargs: Optional[Dict[str, Any]] = None,
) -> Any:
    resolved_model = model_name or resolve_model_for_intent(intent) or settings.MODEL_ALIAS_SMART
    return create_chat_model(
        model_name=resolved_model,
        temperature=temperature,
        max_tokens=max_tokens or settings.DEFAULT_MAX_TOKENS,
        model_kwargs=model_kwargs or {},
    )


async def invoke_structured(
    llm: Any,
    schema: Any,
    messages: list[Any],
    *,
    config: Optional[dict] = None,
) -> dict:
    return await ainvoke_structured_json(
        llm=llm,
        schema=schema,
        messages=messages,
        config=config,
    )
