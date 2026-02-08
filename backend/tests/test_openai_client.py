import pytest
from unittest.mock import MagicMock, patch
from utils.openai_client import create_chat_model


@patch("utils.openai_client.settings")
@patch("utils.model_registry.get_model_registry")
@patch("utils.openai_client.RateLimitAwareChatLiteLLM")
def test_create_chat_model_openrouter_fallback(
    mock_llm_cls, mock_get_registry, mock_settings
):
    """
    Test that create_chat_model injects OpenRouter-specific fallback parameters
    into the LiteLLM initialization when running in 'openrouter' mode.
    """
    # 1. Setup Environment
    mock_settings.LLM_PROVIDER = "openrouter"
    mock_settings.get_temperature.return_value = 0.5

    # 2. Setup Registry with Fallbacks
    mock_registry = MagicMock()
    mock_registry.get_provider.return_value = {
        "provider": "openrouter",
        "defaults": {"fallbacks": ["openrouter/auto"]},
    }
    mock_get_registry.return_value = mock_registry

    # 3. Execution
    create_chat_model("google/gemini-pro")

    # 4. Verification
    # We expect RateLimitAwareChatLiteLLM to be called with specific arguments
    args, kwargs = mock_llm_cls.call_args

    # Check extra_body injection
    assert "extra_body" in kwargs, "extra_body should be injected for OpenRouter"
    extra_body = kwargs["extra_body"]

    assert "models" in extra_body
    assert "route" in extra_body

    # The 'models' list should contain [original_model, fallback_model]
    # Note: LiteLLM might modify the model name passed to constructor,
    # but extra_body['models'] should usually preserve what we send unless we transform it.
    # The original implementation ensures 'openrouter/' prefix for the main model param,
    # so we should check if our logic handles that consistency in the models list too.
    assert extra_body["models"] == ["openrouter/google/gemini-pro", "openrouter/auto"]
    assert extra_body["route"] == "fallback"
