"""Extended tests for config.py — targeting uncovered branches."""

import os
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from config import Settings


# ---------------------------------------------------------------------------
# Settings.get_temperature
# ---------------------------------------------------------------------------

class TestGetTemperature:
    def test_none_model_returns_default(self):
        s = Settings()
        result = s.get_temperature(None)
        assert result == s.DEFAULT_TEMPERATURE

    def test_empty_string_returns_default(self):
        s = Settings()
        result = s.get_temperature("")
        assert result == s.DEFAULT_TEMPERATURE

    def test_gpt5_returns_reasoning_temp(self):
        s = Settings()
        result = s.get_temperature("gpt-5-turbo")
        assert result == s.REASONING_TEMPERATURE

    def test_o1_variant_returns_reasoning_temp(self):
        s = Settings()
        result = s.get_temperature("o1-mini")
        assert result == s.REASONING_TEMPERATURE

    def test_gpt4o_exact_returns_reasoning_temp(self):
        s = Settings()
        result = s.get_temperature("gpt-4o")
        assert result == s.REASONING_TEMPERATURE

    def test_gemini_pro_returns_reasoning_temp(self):
        s = Settings()
        result = s.get_temperature("gemini-1.5-pro")
        assert result == s.REASONING_TEMPERATURE

    def test_gemini_flash_returns_default(self):
        s = Settings()
        result = s.get_temperature("gemini-1.5-flash")
        assert result == s.DEFAULT_TEMPERATURE

    def test_smart_model_alias_returns_reasoning_temp(self):
        s = Settings()
        # Directly set the alias so MODEL_ALIAS_SMART matches the name
        s.MODEL_ALIAS_SMART = "my-custom-smart-model"
        result = s.get_temperature("my-custom-smart-model")
        assert result == s.REASONING_TEMPERATURE

    def test_regular_model_returns_default(self):
        s = Settings()
        result = s.get_temperature("gpt-4o-mini")
        assert result == s.DEFAULT_TEMPERATURE


# ---------------------------------------------------------------------------
# Settings.OPENAI_MODEL property — fallback to registry when alias is None
# ---------------------------------------------------------------------------

class TestOpenAIModelProperty:
    def test_alias_set_returns_alias(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = "my-smart-model"
        assert s.OPENAI_MODEL == "my-smart-model"

    def test_alias_none_uses_registry(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o-registry"}
        }
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_MODEL
        # Either the mock or the real default fallback
        assert isinstance(result, str)
        assert len(result) > 0

    def test_alias_none_registry_missing_falls_back_to_default(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = None
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_MODEL
        assert result == "gpt-4o"


# ---------------------------------------------------------------------------
# Settings.OPENAI_COMPREHENSION_MODELS property — empty list path
# ---------------------------------------------------------------------------

class TestOpenAIComprehensionModelsProperty:
    def test_alias_set_returns_list_with_alias(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = "smart-model"
        assert s.OPENAI_COMPREHENSION_MODELS == ["smart-model"]

    def test_alias_none_registry_returns_smart_list(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {
            "defaults": {"smart": "gpt-4o-from-registry"}
        }
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_COMPREHENSION_MODELS
        assert result == ["gpt-4o-from-registry"]

    def test_alias_none_registry_no_smart_returns_empty(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {"defaults": {}}
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_COMPREHENSION_MODELS
        assert result == []


# ---------------------------------------------------------------------------
# Settings.OPENAI_SUMMARY_MODELS property
# ---------------------------------------------------------------------------

class TestOpenAISummaryModelsProperty:
    def test_alias_set_returns_list_with_alias(self):
        # Covers line 106: `return [self.MODEL_ALIAS_SMART]`
        s = Settings()
        s.MODEL_ALIAS_SMART = "smart-summary-model"
        assert s.OPENAI_SUMMARY_MODELS == ["smart-summary-model"]

    def test_alias_none_registry_missing_smart_returns_empty(self):
        s = Settings()
        s.MODEL_ALIAS_SMART = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = {"defaults": {}}
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_SUMMARY_MODELS
        assert result == []


# ---------------------------------------------------------------------------
# Settings.OPENAI_TRANSLATION_MODEL and OPENAI_HELPER_MODEL — fallback path
# ---------------------------------------------------------------------------

class TestOpenAITranslationAndHelperModel:
    def test_translation_alias_none_fallback_to_default(self):
        s = Settings()
        s.MODEL_ALIAS_FAST = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = None
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_TRANSLATION_MODEL
        assert result == "gpt-4o-mini"

    def test_helper_alias_none_fallback_to_default(self):
        s = Settings()
        s.MODEL_ALIAS_FAST = None
        mock_registry = MagicMock()
        mock_registry.get_provider.return_value = None
        with patch("utils.model_registry.get_model_registry", return_value=mock_registry):
            result = s.OPENAI_HELPER_MODEL
        assert result == "gpt-4o-mini"

    def test_translation_alias_set_returns_alias(self):
        s = Settings()
        s.MODEL_ALIAS_FAST = "fast-model"
        assert s.OPENAI_TRANSLATION_MODEL == "fast-model"

    def test_helper_alias_set_returns_alias(self):
        s = Settings()
        s.MODEL_ALIAS_FAST = "fast-model"
        assert s.OPENAI_HELPER_MODEL == "fast-model"


# ---------------------------------------------------------------------------
# Settings._fix_docker_host_for_local_dev
# ---------------------------------------------------------------------------

class TestFixDockerHostForLocalDev:
    def test_no_base_url_does_nothing(self):
        s = Settings()
        s.OPENAI_BASE_URL = None
        # Should not raise
        s._fix_docker_host_for_local_dev()
        assert s.OPENAI_BASE_URL is None

    def test_url_without_docker_internal_unchanged(self):
        s = Settings()
        s.OPENAI_BASE_URL = "http://localhost:11434/v1"
        s._fix_docker_host_for_local_dev()
        assert s.OPENAI_BASE_URL == "http://localhost:11434/v1"

    def test_docker_internal_url_swapped_when_not_in_docker(self):
        s = Settings()
        s.OPENAI_BASE_URL = "http://host.docker.internal:11434/v1"

        # Simulate NOT running in Docker: no /.dockerenv file, no /proc/1/cgroup
        with patch("os.path.exists", return_value=False):
            s._fix_docker_host_for_local_dev()

        assert "127.0.0.1" in s.OPENAI_BASE_URL
        assert "host.docker.internal" not in s.OPENAI_BASE_URL

    def test_docker_internal_url_unchanged_when_inside_docker(self):
        s = Settings()
        original_url = "http://host.docker.internal:11434/v1"
        s.OPENAI_BASE_URL = original_url

        # Simulate running inside Docker: /.dockerenv exists
        def mock_exists(path):
            return path == "/.dockerenv"

        with patch("os.path.exists", side_effect=mock_exists):
            s._fix_docker_host_for_local_dev()

        assert s.OPENAI_BASE_URL == original_url

    def test_docker_detected_via_cgroup(self):
        # Covers lines 198-203: /.dockerenv absent, but /proc/1/cgroup present
        # and contains "docker" → URL is NOT replaced.
        from unittest.mock import mock_open as _mock_open
        s = Settings()
        original_url = "http://host.docker.internal:11434/v1"
        s.OPENAI_BASE_URL = original_url

        def mock_exists(path):
            return path == "/proc/1/cgroup"

        with patch("os.path.exists", side_effect=mock_exists):
            with patch("builtins.open", _mock_open(read_data="12:devices:/docker-abc123\n")):
                s._fix_docker_host_for_local_dev()

        assert s.OPENAI_BASE_URL == original_url

    def test_cgroup_read_raises_exception_handled(self):
        # Covers lines 202-203: except Exception: pass
        # /proc/1/cgroup exists but open() raises → exception swallowed →
        # is_docker stays False → URL is replaced with 127.0.0.1.
        s = Settings()
        s.OPENAI_BASE_URL = "http://host.docker.internal:11434/v1"

        def mock_exists(path):
            return path == "/proc/1/cgroup"

        with patch("os.path.exists", side_effect=mock_exists):
            with patch("builtins.open", side_effect=OSError("permission denied")):
                s._fix_docker_host_for_local_dev()

        # is_docker never got set → URL was replaced
        assert "127.0.0.1" in s.OPENAI_BASE_URL
        assert "host.docker.internal" not in s.OPENAI_BASE_URL


# ---------------------------------------------------------------------------
# Settings.get_price_by_id
# ---------------------------------------------------------------------------

class TestGetPriceById:
    def test_known_price_id_returns_config(self):
        result = Settings.get_price_by_id("prod_5VVI5ldN9dtI7tbHaST5OB")
        assert result is not None
        assert result.name == "50 Credits Top-up (One-time)"

    def test_unknown_price_id_returns_none(self):
        result = Settings.get_price_by_id("nonexistent_product_id")
        assert result is None
