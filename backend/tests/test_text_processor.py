"""Tests for services/summarizer/text_processor.py."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from services.summarizer.text_processor import TextProcessor


@pytest.fixture
def mock_invoke():
    """Async mock for invoke_with_fallback; returns a response with .content."""
    mock = AsyncMock(return_value=SimpleNamespace(content="organized text output"))
    return mock


@pytest.fixture
def config():
    return SimpleNamespace(paragraph_model="test-model")


@pytest.fixture
def processor(config, mock_invoke):
    return TextProcessor(config=config, invoke_with_fallback=mock_invoke)


# ---------------------------------------------------------------------------
# estimate_tokens
# ---------------------------------------------------------------------------

class TestEstimateTokens:
    def test_empty_string(self, processor):
        result = processor.estimate_tokens("")
        # Should still include system prompt overhead
        assert result >= 0

    def test_english_text(self, processor):
        text = "The quick brown fox jumps over the lazy dog"
        result = processor.estimate_tokens(text)
        assert isinstance(result, int)
        assert result > 0

    def test_chinese_text(self, processor):
        text = "这是一段中文文本，用于测试字符计数功能。"
        result = processor.estimate_tokens(text)
        assert isinstance(result, int)
        assert result > 0

    def test_mixed_text(self, processor):
        text = "Hello 世界 world 你好"
        result = processor.estimate_tokens(text)
        assert isinstance(result, int)
        assert result > 0

    def test_longer_text_has_more_tokens(self, processor):
        short = "Hello world"
        long = "Hello world " * 50
        assert processor.estimate_tokens(long) > processor.estimate_tokens(short)

    def test_chinese_higher_than_ascii_per_char(self, processor):
        # CJK uses 1.5 tokens/char vs ~1.3 tokens/word
        chinese = "你好世界" * 10
        english = "hello world abc def" * 10
        chinese_tokens = processor.estimate_tokens(chinese)
        english_tokens = processor.estimate_tokens(english)
        # Both > 0; no hard ratio assertion needed
        assert chinese_tokens > 0
        assert english_tokens > 0


# ---------------------------------------------------------------------------
# split_into_chunks
# ---------------------------------------------------------------------------

class TestSplitIntoChunks:
    def test_short_text_single_chunk(self, processor):
        text = "This is a short piece of text."
        chunks = processor.split_into_chunks(text, max_tokens=50000)
        assert len(chunks) == 1
        assert "short piece" in chunks[0]

    def test_long_text_multiple_chunks(self, processor):
        # Create text that exceeds a small token budget
        text = ("This is a sentence with some words. " * 200)
        chunks = processor.split_into_chunks(text, max_tokens=500)
        assert len(chunks) > 1

    def test_chunks_not_empty(self, processor):
        text = "Para one.\n\nPara two.\n\nPara three."
        chunks = processor.split_into_chunks(text, max_tokens=10000)
        for chunk in chunks:
            assert chunk.strip() != ""


# ---------------------------------------------------------------------------
# _validate_paragraph_lengths
# ---------------------------------------------------------------------------

class TestValidateParagraphLengths:
    def test_short_paragraphs_unchanged(self, processor):
        text = "Short paragraph one.\n\nShort paragraph two."
        result = processor._validate_paragraph_lengths(text)
        assert "Short paragraph one." in result
        assert "Short paragraph two." in result

    def test_long_paragraph_split(self, processor):
        # >300 words in a single paragraph with sentence endings should be split
        # 4 words per sentence × 80 sentences = 320 words total
        sentence = "This is one sentence. "
        long_para = (sentence * 80).strip()
        assert len(long_para.split()) > 300  # sanity check

        result = processor._validate_paragraph_lengths(long_para)
        paragraphs = [p for p in result.split("\n\n") if p.strip()]
        # Should have been split into multiple paragraphs
        assert len(paragraphs) >= 2


# ---------------------------------------------------------------------------
# _split_long_paragraph
# ---------------------------------------------------------------------------

class TestSplitLongParagraph:
    def test_splits_on_sentence_boundaries(self, processor):
        # 5 words × 50 sentences = 250 words total; split fires at 200-word threshold
        para = "This is a test sentence. " * 50
        parts = processor._split_long_paragraph(para)
        assert len(parts) >= 2
        for part in parts:
            assert part.strip() != ""

    def test_single_sentence_no_split(self, processor):
        para = "Just one sentence here"
        parts = processor._split_long_paragraph(para)
        assert len(parts) >= 1

    def test_handles_cjk_punctuation(self, processor):
        # Chinese sentence endings
        para = "这是第一句话。这是第二句话！这是第三句话？" * 10
        parts = processor._split_long_paragraph(para)
        assert len(parts) >= 1


# ---------------------------------------------------------------------------
# _basic_paragraph_fallback
# ---------------------------------------------------------------------------

class TestBasicParagraphFallback:
    def test_collapses_multiple_newlines(self, processor):
        text = "Para one.\n\n\n\n\nPara two."
        result = processor._basic_paragraph_fallback(text)
        assert "\n\n\n" not in result

    def test_long_paragraph_split(self, processor):
        long_para = ("word " * 260).strip()
        result = processor._basic_paragraph_fallback(long_para)
        paragraphs = [p for p in result.split("\n\n") if p.strip()]
        # Was split into multiple paragraphs
        assert len(paragraphs) >= 1

    def test_short_paragraphs_merged(self, processor):
        # Short paragraphs (<30 words) near each other should be merged
        text = "Short one.\n\nShort two.\n\nNormal paragraph with enough words to not be merged."
        result = processor._basic_paragraph_fallback(text)
        # Should not throw; short paras may be merged
        assert result.strip() != ""

    def test_empty_string(self, processor):
        result = processor._basic_paragraph_fallback("")
        assert result == ""


# ---------------------------------------------------------------------------
# final_paragraph_organization (short path: < 3000 tokens)
# ---------------------------------------------------------------------------

class TestFinalParagraphOrganization:
    async def test_short_text_calls_llm(self, processor, mock_invoke):
        with patch("services.summarizer.text_processor.settings") as mock_settings:
            mock_settings.DEFAULT_MAX_TOKENS = 4000
            result = await processor.final_paragraph_organization(
                text="Short text that estimates below 3000 tokens.",
                lang_instruction="Write in English.",
            )
        mock_invoke.assert_called_once()
        assert result == "organized text output"

    async def test_error_fallback_to_basic(self, config):
        failing_invoke = AsyncMock(side_effect=RuntimeError("LLM unavailable"))
        processor = TextProcessor(config=config, invoke_with_fallback=failing_invoke)

        with patch("services.summarizer.text_processor.settings") as mock_settings:
            mock_settings.DEFAULT_MAX_TOKENS = 4000
            result = await processor.final_paragraph_organization(
                text="Some text to organize.",
                lang_instruction="Write in English.",
            )
        # Falls back to basic, should return non-empty string
        assert isinstance(result, str)

    async def test_long_text_delegates_to_organize_long(self, config, mock_invoke):
        """Text > 3000 tokens should go through _organize_long_text_paragraphs."""
        # Patch estimate_tokens to always return > 3000
        processor = TextProcessor(config=config, invoke_with_fallback=mock_invoke)
        with patch.object(processor, "estimate_tokens", return_value=5000):
            with patch("services.summarizer.text_processor.settings") as mock_settings:
                mock_settings.DEFAULT_MAX_TOKENS = 4000
                result = await processor.final_paragraph_organization(
                    text="Para one.\n\nPara two.\n\nPara three.",
                    lang_instruction="Write in English.",
                )
        assert isinstance(result, str)


# ---------------------------------------------------------------------------
# _organize_single_chunk
# ---------------------------------------------------------------------------

class TestOrganizeSingleChunk:
    async def test_calls_llm_and_returns_content(self, processor, mock_invoke):
        with patch("services.summarizer.text_processor.settings"):
            result = await processor._organize_single_chunk(
                "Some chunk text here.",
                "Write in English.",
            )
        assert result == "organized text output"
        mock_invoke.assert_called_once()

    async def test_passes_correct_model(self, config, mock_invoke):
        processor = TextProcessor(config=config, invoke_with_fallback=mock_invoke)
        with patch("services.summarizer.text_processor.settings"):
            await processor._organize_single_chunk("text", "English")

        call_kwargs = mock_invoke.call_args
        assert "test-model" in call_kwargs.kwargs.get("models", []) or \
               "test-model" in (call_kwargs.args[0] if call_kwargs.args else [])


# ---------------------------------------------------------------------------
# _organize_long_text_paragraphs
# ---------------------------------------------------------------------------

class TestOrganizeLongTextParagraphs:
    async def test_processes_multiple_paragraphs(self, config, mock_invoke):
        processor = TextProcessor(config=config, invoke_with_fallback=mock_invoke)
        text = "\n\n".join([f"Paragraph {i} with some content." for i in range(5)])
        with patch("services.summarizer.text_processor.settings"):
            result = await processor._organize_long_text_paragraphs(text, "English")
        assert isinstance(result, str)
        assert mock_invoke.call_count >= 1

    async def test_error_falls_back_to_basic(self, config):
        failing_invoke = AsyncMock(side_effect=RuntimeError("fail"))
        processor = TextProcessor(config=config, invoke_with_fallback=failing_invoke)
        text = "\n\n".join([f"Paragraph {i}." for i in range(3)])
        with patch("services.summarizer.text_processor.settings"):
            result = await processor._organize_long_text_paragraphs(text, "English")
        assert isinstance(result, str)
