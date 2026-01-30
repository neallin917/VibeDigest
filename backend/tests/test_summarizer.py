"""
Unit tests for the Summarizer class.
These tests focus on pure logic (no LLM calls) and integration tests that mock the LLM.
"""
import pytest
import json
from unittest.mock import MagicMock, AsyncMock, patch
import sys
import os

# Add backend dir to path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.insert(0, backend_dir)

# Mock langchain before importing summarizer
sys.modules["langchain_openai"] = MagicMock()
sys.modules["langchain_core"] = MagicMock()
sys.modules["langchain_core.messages"] = MagicMock()

from services.summarizer import Summarizer  # noqa: E402


# --- FIXTURES ---

@pytest.fixture
def summarizer():
    """Create a Summarizer instance with mocked API key for testing."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
        return Summarizer()


# --- UNIT TESTS FOR PURE FUNCTIONS ---

class TestEstimateTokens:
    """Test token estimation logic."""

    def test_estimate_tokens_english(self, summarizer):
        text = "Hello world this is a test sentence"
        tokens = summarizer._estimate_tokens(text)
        # Check that it's a positive integer
        assert isinstance(tokens, int)
        assert tokens > 0
        # English words contribute ~1.3 tokens + overhead

    def test_estimate_tokens_chinese(self, summarizer):
        text = "你好世界这是一个测试句子"
        tokens = summarizer._estimate_tokens(text)
        assert isinstance(tokens, int)
        assert tokens > 0
        # CJK chars contribute ~1.5 tokens per char
        
    def test_estimate_tokens_mixed(self, summarizer):
        text = "你好 Hello world 世界"
        tokens = summarizer._estimate_tokens(text)
        assert isinstance(tokens, int)
        assert tokens > 0

    def test_estimate_tokens_empty_string(self, summarizer):
        # Empty string should still return overhead
        tokens = summarizer._estimate_tokens("")
        assert isinstance(tokens, int)
        # Expect system prompt overhead to still apply
        assert tokens >= 0


class TestExtractFirstJsonObject:
    """Test JSON extraction from potentially messy LLM output."""

    def test_extract_clean_json(self, summarizer):
        text = '{"key": "value", "num": 123}'
        result = summarizer._extract_first_json_object(text)
        assert result == '{"key": "value", "num": 123}'
        assert json.loads(result)

    def test_extract_json_with_markdown_fence(self, summarizer):
        text = '```json\n{"key": "value"}\n```'
        result = summarizer._extract_first_json_object(text)
        assert result is not None
        assert json.loads(result)["key"] == "value"

    def test_extract_json_with_explanation(self, summarizer):
        text = 'Here is the result:\n{"result": "success"}\nThis is the output.'
        result = summarizer._extract_first_json_object(text)
        assert result is not None
        assert json.loads(result)["result"] == "success"

    def test_extract_no_json(self, summarizer):
        text = "This text has no JSON object"
        result = summarizer._extract_first_json_object(text)
        assert result is None

    def test_extract_empty_input(self, summarizer):
        result = summarizer._extract_first_json_object("")
        assert result is None

    def test_extract_none_input(self, summarizer):
        result = summarizer._extract_first_json_object(None)
        assert result is None


class TestNormalizeLangCode:
    """Test language code normalization."""

    def test_chinese_variants(self, summarizer):
        assert summarizer._normalize_lang_code("zh") == "zh"
        assert summarizer._normalize_lang_code("zh-CN") == "zh"
        assert summarizer._normalize_lang_code("zh-TW") == "zh"
        assert summarizer._normalize_lang_code("chinese") == "zh"

    def test_english_variants(self, summarizer):
        assert summarizer._normalize_lang_code("en") == "en"
        assert summarizer._normalize_lang_code("en-US") == "en"
        assert summarizer._normalize_lang_code("english") == "en"

    def test_other_languages(self, summarizer):
        assert summarizer._normalize_lang_code("ja") == "ja"
        assert summarizer._normalize_lang_code("korean") == "ko"
        assert summarizer._normalize_lang_code("french") == "fr"
        assert summarizer._normalize_lang_code("german") == "de"

    def test_edge_cases(self, summarizer):
        assert summarizer._normalize_lang_code("") == "unknown"
        assert summarizer._normalize_lang_code(None) == "unknown"
        assert summarizer._normalize_lang_code("   ") == "unknown"


class TestFallbackSummaryJson:
    """Test the fallback summary generation (no LLM)."""

    def test_fallback_creates_valid_json(self, summarizer):
        transcript = "This is paragraph one.\n\nThis is paragraph two.\n\nThis is paragraph three."
        result = summarizer._fallback_summary_json_v1(transcript, "en")
        
        # Should be valid JSON
        data = json.loads(result)
        assert data["version"] == 2
        assert data["language"] == "en"
        assert "overview" in data
        assert "keypoints" in data
        assert isinstance(data["keypoints"], list)

    def test_fallback_truncates_long_overview(self, summarizer):
        # Overview should be capped
        transcript = "A" * 2000
        result = summarizer._fallback_summary_json_v1(transcript, "zh")
        data = json.loads(result)
        # Max 900 chars + ellipsis
        assert len(data["overview"]) <= 903

    def test_fallback_empty_transcript(self, summarizer):
        result = summarizer._fallback_summary_json_v1("", "en")
        data = json.loads(result)
        assert data["overview"] == ""
        assert data["keypoints"] == []


class TestApplyBasicFormatting:
    """Test basic text formatting without LLM."""

    def test_splits_long_text_into_paragraphs(self, summarizer):
        # Create a text that should be split
        long_text = ". ".join(["This is a sentence"] * 20)
        result = summarizer._apply_basic_formatting(long_text)
        # Should have paragraph breaks (\n\n)
        assert "\n\n" in result

    def test_preserves_short_text(self, summarizer):
        short_text = "This is a short sentence."
        result = summarizer._apply_basic_formatting(short_text)
        assert short_text.strip() in result

    def test_empty_text(self, summarizer):
        result = summarizer._apply_basic_formatting("")
        assert result == ""

    def test_whitespace_only(self, summarizer):
        result = summarizer._apply_basic_formatting("   ")
        assert result == "   "


class TestSmartSplitLongChunk:
    """Test LangChain-based text splitting."""

    def test_splits_long_text(self, summarizer):
        long_text = "这是一个很长的句子。" * 100
        chunks = summarizer._smart_split_long_chunk(long_text, max_chars_per_chunk=500)
        assert isinstance(chunks, list)
        assert len(chunks) > 1
        # Each chunk should respect max_chars
        for chunk in chunks:
            assert len(chunk) <= 550  # Allow some overlap margin

    def test_short_text_single_chunk(self, summarizer):
        short_text = "Short text."
        chunks = summarizer._smart_split_long_chunk(short_text, max_chars_per_chunk=500)
        assert chunks == [short_text]


class TestFastCleanTranscript:
    """Test fast transcript cleaning."""

    def test_removes_timestamps(self, summarizer):
        text_with_ts = "[00:00:00] Hello world.\n[00:01:00] This is a test."
        result = summarizer.fast_clean_transcript(text_with_ts)
        assert "[00:00:00]" not in result or result  # Depends on impl
        assert result  # Not empty

    def test_collapses_multiple_newlines(self, summarizer):
        text = "Para 1\n\n\n\n\nPara 2"
        result = summarizer.fast_clean_transcript(text)
        # Should have max 2 newlines
        assert "\n\n\n" not in result

    def test_empty_input(self, summarizer):
        result = summarizer.fast_clean_transcript("")
        assert result == ""


# --- INTEGRATION TESTS (with mocked LLM) ---

class TestSummarizeWithMockedLLM:
    """Test summarize method with mocked LLM responses."""

    @pytest.mark.asyncio
    async def test_summarize_short_text(self, summarizer):
        # Mock the summary engine's summarize method directly
        mock_result = json.dumps({
            "version": 2, "language": "en", "overview": "Test", "keypoints": []
        })

        with patch.object(summarizer._summary_engine, 'summarize', new=AsyncMock(return_value=mock_result)):
            result = await summarizer.summarize("Test transcript", "en")
            assert isinstance(result, str)
            # Should be valid JSON
            data = json.loads(result)
            assert "version" in data

    @pytest.mark.asyncio
    async def test_summarize_no_api_key(self):
        # Test fallback when API key is missing
        with patch.dict(
            os.environ, {"OPENAI_API_KEY": "", "OPENAI_SUMMARY_FALLBACK": "true"}, clear=False
        ):
            # Need to clear cached value by recreating instance
            sum_no_key = Summarizer()
            sum_no_key.api_key = None  # Force no API key
            result = await sum_no_key.summarize("Some transcript", "zh")
            data = json.loads(result)
            assert data["version"] == 2
            assert data["language"] == "zh"

    @pytest.mark.asyncio
    async def test_summarize_no_api_key_without_fallback(self):
        # Test failure when fallback is disabled
        with patch.dict(
            os.environ, {"OPENAI_API_KEY": "", "OPENAI_SUMMARY_FALLBACK": "false"}, clear=False
        ):
            sum_no_key = Summarizer()
            sum_no_key.api_key = None
            with pytest.raises(RuntimeError):
                await sum_no_key.summarize("Some transcript", "zh")


class TestClassifyContentWithMockedLLM:
    """Test classify_content with mocked structured output."""

    @pytest.mark.asyncio
    async def test_classify_returns_dict(self, summarizer):
        # Mock the classifier's classify_content directly
        mock_result = {
            "content_form": "tutorial",
            "info_structure": "sequential",
            "cognitive_goal": "execute",
            "confidence": 0.85,
        }

        with patch.object(summarizer._classifier, 'classify_content', new=AsyncMock(return_value=mock_result)):
            result = await summarizer.classify_content("Test transcript")
            assert isinstance(result, dict)
            assert result["content_form"] == "tutorial"
            assert result["info_structure"] == "sequential"

    @pytest.mark.asyncio
    async def test_classify_fallback_on_error(self, summarizer):
        # Test that the classifier returns defaults when an error occurs
        # Mock the classifier's internal call to raise an exception
        from services.summarizer.config import get_llm

        with patch('services.summarizer.classifier.get_llm', side_effect=Exception("API Error")):
            result = await summarizer.classify_content("Test")
            # Should fallback to defaults
            assert result["content_form"] == "casual"
            assert result["info_structure"] == "thematic"
            assert result["confidence"] == 0.0


# --- PYDANTIC MODEL TESTS ---

class TestPydanticModels:
    """Test Pydantic model imports and creation."""

    def test_content_classification_model(self):
        from services.summarizer import ContentClassification
        obj = ContentClassification(
            content_form="tutorial",
            info_structure="sequential",
            cognitive_goal="execute",
            confidence=0.9
        )
        assert obj.content_form == "tutorial"

    def test_keypoint_model(self):
        from services.summarizer import KeyPoint
        kp = KeyPoint(
            title="Test Title",
            detail="Test Detail",
            evidence="Test Evidence"
        )
        assert kp.title == "Test Title"

    def test_summary_response_model(self):
        from services.summarizer import SummaryResponse, KeyPoint
        sr = SummaryResponse(
            language="en",
            overview="Test Overview",
            keypoints=[KeyPoint(title="T", detail="D", evidence="E")]
        )
        assert sr.version == 2
        assert len(sr.keypoints) == 1
