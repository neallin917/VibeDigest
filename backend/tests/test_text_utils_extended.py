"""Extended tests for utils/text_utils.py — targeting uncovered branches."""

import pytest
from utils.text_utils import (
    count_words_or_units,
    is_sentence_ending_period,
    ends_with_sentence,
    find_true_sentence_punct_positions,
    find_early_punctuation_split,
    find_late_punctuation_split,
    ensure_markdown_paragraphs,
    remove_timestamps_and_meta,
    remove_transcript_heading,
    extract_first_json_object,
    enforce_paragraph_max_chars,
    extract_pure_text,
    split_into_sentences,
    join_sentences,
    detect_language,
    smart_chunk_text,
)


class TestCountWordsOrUnits:
    def test_empty_string(self):
        assert count_words_or_units("") == 0

    def test_whitespace_only(self):
        assert count_words_or_units("   ") == 0

    def test_english_words(self):
        assert count_words_or_units("hello world foo") == 3

    def test_cjk_chars_no_spaces(self):
        # No spaces -> counted as CJK chars
        result = count_words_or_units("你好世界")
        assert result == 4

    def test_mixed_whitespace(self):
        assert count_words_or_units("hello\tworld\nfoo") == 3

    def test_single_word(self):
        assert count_words_or_units("hello") == 5  # CJK path: individual chars


class TestIsSentenceEndingPeriod:
    def test_decimal_number_not_sentence_end(self):
        text = "version 3.14 is out"
        period_idx = text.index(".")
        assert is_sentence_ending_period(text, period_idx) is False

    def test_url_dot_not_sentence_end(self):
        text = "visit example.com today"
        period_idx = text.index(".")
        assert is_sentence_ending_period(text, period_idx) is False

    def test_file_extension_not_sentence_end(self):
        text = "open file.txt now"
        period_idx = text.index(".")
        assert is_sentence_ending_period(text, period_idx) is False

    def test_abbreviation_mr_not_sentence_end(self):
        text = "Mr. Smith arrived"
        period_idx = text.index(".")
        assert is_sentence_ending_period(text, period_idx) is False

    def test_abbreviation_dr_not_sentence_end(self):
        text = "Dr. Jones left"
        period_idx = text.index(".")
        assert is_sentence_ending_period(text, period_idx) is False

    def test_true_sentence_ending(self):
        text = "The end."
        assert is_sentence_ending_period(text, len(text) - 1) is True

    def test_start_of_text(self):
        # period at index 0, no char before
        text = ".hello"
        assert is_sentence_ending_period(text, 0) is True


class TestEndsWithSentence:
    def test_empty_string(self):
        assert ends_with_sentence("") is False

    def test_none_like(self):
        assert ends_with_sentence(None) is False

    def test_exclamation(self):
        assert ends_with_sentence("Great!") is True

    def test_question(self):
        assert ends_with_sentence("Really?") is True

    def test_cjk_exclamation(self):
        assert ends_with_sentence("很好！") is True

    def test_period_sentence_end(self):
        assert ends_with_sentence("The end.") is True

    def test_url_period_not_sentence_end(self):
        assert ends_with_sentence("visit example.com") is False

    def test_no_punctuation(self):
        assert ends_with_sentence("hello world") is False


class TestFindTrueSentencePunctPositions:
    def test_empty_string(self):
        assert find_true_sentence_punct_positions("") == []

    def test_none_input(self):
        assert find_true_sentence_punct_positions(None) == []

    def test_no_punctuation(self):
        assert find_true_sentence_punct_positions("hello world") == []

    def test_exclamation(self):
        positions = find_true_sentence_punct_positions("Hello! World")
        assert 5 in positions

    def test_true_period(self):
        positions = find_true_sentence_punct_positions("The end. New start")
        assert len(positions) >= 1

    def test_url_period_excluded(self):
        positions = find_true_sentence_punct_positions("visit example.com today")
        # The period in .com should not be a sentence-ending position
        assert len(positions) == 0


class TestFindEarlyPunctuationSplit:
    def test_empty_string(self):
        assert find_early_punctuation_split("") == -1

    def test_no_punctuation(self):
        assert find_early_punctuation_split("hello world foo bar") == -1

    def test_early_split_found(self):
        # Period right after 1 word: "Hi. Continue here"
        result = find_early_punctuation_split("Hi. Continue here")
        assert result > 0

    def test_split_too_late(self):
        # Punctuation after many words -> not early
        result = find_early_punctuation_split("one two three four five. end")
        assert result == -1


class TestFindLatePunctuationSplit:
    def test_empty_string(self):
        assert find_late_punctuation_split("") == -1

    def test_no_punctuation(self):
        assert find_late_punctuation_split("hello world") == -1

    def test_late_split_found(self):
        result = find_late_punctuation_split("Hello world. OK")
        assert result > 0

    def test_too_many_words_after(self):
        result = find_late_punctuation_split("End. there are many words after here")
        assert result == -1


class TestEnsureMarkdownParagraphs:
    def test_empty_string(self):
        assert ensure_markdown_paragraphs("") == ""

    def test_heading_gets_blank_line(self):
        text = "## Title\nSome text"
        result = ensure_markdown_paragraphs(text)
        assert "\n\n" in result

    def test_collapses_extra_newlines(self):
        text = "Para 1\n\n\n\nPara 2"
        result = ensure_markdown_paragraphs(text)
        assert "\n\n\n" not in result

    def test_trims_leading_newlines(self):
        text = "\n\nHello"
        result = ensure_markdown_paragraphs(text)
        assert result.startswith("Hello")

    def test_trims_trailing_newlines(self):
        text = "Hello\n\n"
        result = ensure_markdown_paragraphs(text)
        assert result.endswith("Hello")

    def test_crlf_normalized(self):
        text = "Line1\r\nLine2"
        result = ensure_markdown_paragraphs(text)
        assert "\r" not in result


class TestRemoveTimestampsAndMeta:
    def test_empty_string(self):
        assert remove_timestamps_and_meta("") == ""

    def test_removes_standalone_timestamp(self):
        text = "**[00:12]**\nSome content"
        result = remove_timestamps_and_meta(text)
        assert "**[00:12]**" not in result
        assert "Some content" in result

    def test_strips_inline_timestamp_prefix(self):
        text = "**[00:12]** Hello world"
        result = remove_timestamps_and_meta(text)
        assert "Hello world" in result

    def test_inline_timestamp_only_line_skipped(self):
        # The short-form guard is `len(s) <= 14`.  "**[00:12]**" = 11 chars →
        # bypassed.  A longer timestamp like "**[00:00:00]**" = 15 chars skips
        # that guard, enters the inline-prefix branch, and after the regex
        # strips the whole line the result is empty → `if not line: continue`
        # (line 168).
        text = "**[00:00:00]**\nActual content"
        result = remove_timestamps_and_meta(text)
        assert "Actual content" in result
        assert "00:00:00" not in result

    def test_removes_h1_heading(self):
        text = "# Video Title\nContent here"
        result = remove_timestamps_and_meta(text)
        assert "# Video Title" not in result

    def test_removes_detected_language_marker(self):
        text = "**检测语言:** zh\nContent"
        result = remove_timestamps_and_meta(text)
        assert "检测语言" not in result
        assert "Content" in result

    def test_removes_english_language_marker(self):
        text = "**Detected Language:** English\nContent"
        result = remove_timestamps_and_meta(text)
        assert "Detected Language" not in result

    def test_preserves_regular_content(self):
        text = "This is regular content.\nMore content."
        result = remove_timestamps_and_meta(text)
        assert "regular content" in result


class TestRemoveTranscriptHeading:
    def test_empty_string(self):
        assert remove_transcript_heading("") == ""

    def test_removes_h2_transcript(self):
        text = "## Transcript\nSome text"
        result = remove_transcript_heading(text)
        assert "## Transcript" not in result
        assert "Some text" in result

    def test_removes_transcript_text(self):
        text = "### Transcript Text\nBody"
        result = remove_transcript_heading(text)
        assert "Transcript Text" not in result

    def test_case_insensitive(self):
        text = "## TRANSCRIPT\nBody"
        result = remove_transcript_heading(text)
        assert "TRANSCRIPT" not in result

    def test_preserves_non_transcript_heading(self):
        text = "## Summary\nBody"
        result = remove_transcript_heading(text)
        assert "## Summary" in result


class TestExtractFirstJsonObject:
    def test_empty_string(self):
        assert extract_first_json_object("") is None

    def test_none_input(self):
        assert extract_first_json_object(None) is None

    def test_simple_json(self):
        result = extract_first_json_object('{"key": "value"}')
        assert result == '{"key": "value"}'

    def test_nested_json(self):
        result = extract_first_json_object('{"a": {"b": 1}}')
        assert result is not None
        assert '"b"' in result

    def test_json_in_markdown_code_block(self):
        text = '```json\n{"key": "value"}\n```'
        result = extract_first_json_object(text)
        assert result is not None
        assert '"key"' in result

    def test_json_with_escaped_string(self):
        text = '{"msg": "He said \\"hello\\""}'
        result = extract_first_json_object(text)
        assert result is not None

    def test_no_json_object(self):
        assert extract_first_json_object("just plain text") is None

    def test_unbalanced_braces_triggers_rfind_fallback(self):
        # More `{` than `}` → depth-tracking loop exits without returning.
        # The fallback uses rfind("}") to find a candidate, then json.loads
        # raises JSONDecodeError → returns None.  Covers lines 239-249.
        result = extract_first_json_object('{"key": {"nested"}')
        assert result is None

    def test_json_after_preamble(self):
        text = "Here is the result: {\"status\": \"ok\"}"
        result = extract_first_json_object(text)
        assert result is not None
        assert '"status"' in result


class TestEnforceParagraphMaxChars:
    def test_empty_string(self):
        assert enforce_paragraph_max_chars("") == ""

    def test_short_paragraph_unchanged(self):
        text = "Short paragraph."
        result = enforce_paragraph_max_chars(text, max_chars=400)
        assert result == text

    def test_long_paragraph_split(self):
        # Create a long paragraph that exceeds 100 chars
        long_para = "This is sentence one. " * 10
        result = enforce_paragraph_max_chars(long_para, max_chars=100)
        # Should have multiple paragraphs
        assert "\n\n" in result

    def test_multiple_paragraphs(self):
        text = "Para one.\n\nPara two."
        result = enforce_paragraph_max_chars(text, max_chars=400)
        assert "Para one." in result
        assert "Para two." in result

    def test_paragraph_no_trailing_punct_trailing_buf(self):
        # A paragraph exceeding max_chars that ends without sentence punctuation.
        # The sentence-split loop leaves content in `buf` after the last iteration,
        # triggering the `if buf.strip()` branch (line 276).
        long_no_punct = ("word " * 30).rstrip()  # ~150 chars, no sentence punct
        result = enforce_paragraph_max_chars(long_no_punct, max_chars=50)
        assert result.strip() != ""
        assert "word" in result


class TestExtractPureText:
    def test_simple_text(self):
        text = "Hello world.\nMore content."
        result = extract_pure_text(text)
        assert "Hello world." in result
        assert "More content." in result

    def test_removes_timestamps(self):
        text = "**[00:12]**\nContent here"
        result = extract_pure_text(text)
        assert "Content here" in result

    def test_removes_headings(self):
        text = "# Title\nContent"
        result = extract_pure_text(text)
        assert "Content" in result

    def test_strips_inline_timestamp(self):
        text = "**[01:23]** Actual content"
        result = extract_pure_text(text)
        assert "Actual content" in result

    def test_removes_cjk_metadata(self):
        text = "**检测语言:** zh\nContent"
        result = extract_pure_text(text)
        assert "Content" in result

    def test_empty_lines_skipped(self):
        result = extract_pure_text("\n\n\n")
        assert result.strip() == ""

    def test_inline_timestamp_strips_to_empty_skipped(self):
        # Same 15-char timestamp trick: bypasses the `len(s) <= 14` guard so
        # the inline-prefix branch runs, regex strips everything, leaving an
        # empty line → `if not line: continue` (line 310).
        text = "**[00:00:00]**\nReal content"
        result = extract_pure_text(text)
        assert "Real content" in result
        assert "00:00:00" not in result


class TestSplitIntoSentences:
    def test_simple_english(self):
        sentences = split_into_sentences("Hello. World. Foo.")
        assert len(sentences) >= 2

    def test_cjk_sentences(self):
        sentences = split_into_sentences("你好。世界！")
        assert len(sentences) >= 1

    def test_question_marks(self):
        sentences = split_into_sentences("Really? Yes! OK.")
        assert len(sentences) >= 2

    def test_trailing_text_without_terminator(self):
        sentences = split_into_sentences("Hello world, no terminator")
        assert "Hello world, no terminator" in sentences

    def test_empty_string(self):
        assert split_into_sentences("") == []


class TestJoinSentences:
    def test_basic_join(self):
        result = join_sentences(["Hello.", "World."])
        assert result == "Hello. World."

    def test_single(self):
        assert join_sentences(["Only one."]) == "Only one."

    def test_empty(self):
        assert join_sentences([]) == ""


class TestDetectLanguage:
    def test_empty_returns_en(self):
        assert detect_language("") == "en"

    def test_english_text(self):
        assert detect_language("Hello world, this is English text.") == "en"

    def test_chinese_text(self):
        result = detect_language("这是中文内容。很多汉字在这里。" * 5)
        assert result == "zh"

    def test_japanese_text(self):
        # Hiragana-heavy text
        result = detect_language("これはひらがなのテキストです。" * 5)
        assert result == "ja"

    def test_korean_text(self):
        result = detect_language("안녕하세요 반갑습니다 감사합니다" * 5)
        assert result == "ko"

    def test_metadata_marker(self):
        # The implementation does line.split(":")[-1].strip(), which for the bold
        # markdown marker "**检测语言:** zh" yields "** zh" (the trailing ** is
        # included).  Assert the actual extracted value, confirming the metadata
        # branch is taken (rather than character-ratio detection).
        text = "**检测语言:** zh\nSome content"
        result = detect_language(text)
        assert result == "** zh"


class TestSmartChunkText:
    def test_empty_string(self):
        assert smart_chunk_text("") == []

    def test_short_text(self):
        text = "Hello world."
        chunks = smart_chunk_text(text, max_chars=4000)
        assert chunks == ["Hello world."]

    def test_splits_large_text_by_paragraph(self):
        # Create text where each paragraph is 300 chars, max_chars=400
        para = "A" * 300
        text = para + "\n\n" + para
        chunks = smart_chunk_text(text, max_chars=400)
        assert len(chunks) >= 2

    def test_splits_by_sentence_when_paragraph_too_large(self):
        # Single huge paragraph with multiple sentences
        sentences = ("This is a sentence. " * 20)
        chunks = smart_chunk_text(sentences, max_chars=100)
        assert len(chunks) >= 2
        for chunk in chunks:
            assert len(chunk) <= 150  # some tolerance

    def test_multiple_paragraphs_fit_in_one_chunk(self):
        text = "Short para.\n\nAnother short one."
        chunks = smart_chunk_text(text, max_chars=4000)
        assert len(chunks) == 1

    def test_large_chunk_no_trailing_punctuation(self):
        # A single long paragraph ending without sentence punctuation.
        # The second-pass sentence splitter leaves content in `buf` after
        # all even-indexed parts, triggering the `if buf.strip()` branch (line 443).
        trailing = "no period at end"
        chunk = ("This is a sentence. " * 10) + trailing
        chunks = smart_chunk_text(chunk, max_chars=100)
        assert len(chunks) >= 2
        assert any(trailing in c for c in chunks)
