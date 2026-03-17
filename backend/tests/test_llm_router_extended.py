"""Extended tests for utils/llm_router.py — targeting uncovered branches."""

from types import SimpleNamespace
from unittest.mock import MagicMock, AsyncMock, patch

import pytest


class TestResolveModelForIntent:
    def test_known_intent_with_existing_provider(self):
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}
        }
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("chat")

        assert result == "gpt-4o"

    def test_provider_not_found_returns_none(self):
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = None
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("chat")

        assert result is None

    def test_unknown_intent_defaults_to_smart_tier(self):
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}
        }
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("nonexistent_intent")

        assert result == "gpt-4o"

    def test_summary_intent_resolves_to_smart_tier(self):
        """Regression test: summary was incorrectly mapped to 'fast', now fixed to 'smart'."""
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}
        }
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("summary")

        assert result == "gpt-4o"  # smart tier, not fast

    def test_new_summarizer_intents_resolve_to_fast_tier(self):
        """New summarizer sub-task intents should all resolve to the fast tier."""
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}
        }
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        new_intents = ["transcript_optimize", "paragraph", "json_repair", "classifier"]

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            for intent in new_intents:
                result = resolve_model_for_intent(intent)
                assert result == "gpt-4o-mini", (
                    f"Intent '{intent}' expected fast-tier model 'gpt-4o-mini', got '{result}'"
                )

    def test_reexport_create_chat_model(self):
        """create_chat_model must be importable directly from utils.llm_router."""
        from utils.llm_router import create_chat_model  # noqa: F401
        assert callable(create_chat_model)

    def test_reexport_ainvoke_structured_json(self):
        """ainvoke_structured_json must be importable directly from utils.llm_router."""
        from utils.llm_router import ainvoke_structured_json  # noqa: F401
        assert callable(ainvoke_structured_json)

    def test_explicit_provider_overrides_settings(self):
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "claude-3-opus"}
        }
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("chat", provider="anthropic")

        mock_registry.get_provider.assert_called_with("anthropic")
        assert result == "claude-3-opus"

    def test_missing_tier_in_defaults_returns_none(self):
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {"defaults": {}}
        mock_settings = SimpleNamespace(LLM_PROVIDER="openai")

        with patch("utils.llm_router.get_model_registry", return_value=mock_registry), \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import resolve_model_for_intent
            result = resolve_model_for_intent("chat")

        assert result is None


class TestCreateChatModelForIntent:
    def test_creates_model_with_resolved_intent(self):
        mock_model = MagicMock()
        mock_settings = SimpleNamespace(
            LLM_PROVIDER="openai",
            MODEL_ALIAS_SMART="gpt-4o",
            DEFAULT_MAX_TOKENS=4000,
        )

        with patch("utils.llm_router.resolve_model_for_intent", return_value="gpt-4o-mini") as mock_resolve, \
             patch("utils.llm_router.create_chat_model", return_value=mock_model) as mock_create, \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import create_chat_model_for_intent
            result = create_chat_model_for_intent("summary")

        mock_resolve.assert_called_once_with("summary")
        mock_create.assert_called_once()
        assert result is mock_model

    def test_explicit_model_name_skips_resolve(self):
        mock_model = MagicMock()
        mock_settings = SimpleNamespace(
            LLM_PROVIDER="openai",
            MODEL_ALIAS_SMART="gpt-4o",
            DEFAULT_MAX_TOKENS=4000,
        )

        with patch("utils.llm_router.resolve_model_for_intent") as mock_resolve, \
             patch("utils.llm_router.create_chat_model", return_value=mock_model) as mock_create, \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import create_chat_model_for_intent
            result = create_chat_model_for_intent("chat", model_name="custom-model")

        # resolve_model_for_intent should not be called when model_name is explicit
        mock_resolve.assert_not_called()
        call_kwargs = mock_create.call_args
        assert call_kwargs.kwargs.get("model_name") == "custom-model"
        assert result is mock_model

    def test_fallback_to_settings_alias_when_resolve_returns_none(self):
        mock_model = MagicMock()
        mock_settings = SimpleNamespace(
            LLM_PROVIDER="openai",
            MODEL_ALIAS_SMART="fallback-model",
            DEFAULT_MAX_TOKENS=4000,
        )

        with patch("utils.llm_router.resolve_model_for_intent", return_value=None), \
             patch("utils.llm_router.create_chat_model", return_value=mock_model) as mock_create, \
             patch("utils.llm_router.settings", mock_settings):
            from utils.llm_router import create_chat_model_for_intent
            create_chat_model_for_intent("chat")

        call_kwargs = mock_create.call_args
        assert call_kwargs.kwargs.get("model_name") == "fallback-model"


class TestInvokeStructured:
    async def test_delegates_to_ainvoke_structured_json(self):
        mock_llm = MagicMock()
        mock_schema = MagicMock()
        mock_messages = [{"role": "user", "content": "hello"}]
        expected_result = {"key": "value"}

        with patch("utils.llm_router.ainvoke_structured_json", new_callable=AsyncMock) as mock_ainvoke:
            mock_ainvoke.return_value = expected_result
            from utils.llm_router import invoke_structured
            result = await invoke_structured(
                llm=mock_llm,
                schema=mock_schema,
                messages=mock_messages,
            )

        mock_ainvoke.assert_called_once_with(
            llm=mock_llm,
            schema=mock_schema,
            messages=mock_messages,
            config=None,
        )
        assert result == expected_result

    async def test_passes_config_when_provided(self):
        mock_llm = MagicMock()
        mock_config = {"timeout": 30}

        with patch("utils.llm_router.ainvoke_structured_json", new_callable=AsyncMock) as mock_ainvoke:
            mock_ainvoke.return_value = {}
            from utils.llm_router import invoke_structured
            await invoke_structured(
                llm=mock_llm,
                schema=MagicMock(),
                messages=[],
                config=mock_config,
            )

        call_kwargs = mock_ainvoke.call_args
        assert call_kwargs.kwargs.get("config") == mock_config
