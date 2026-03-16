"""Extended tests for services/formatting.py — targeting uncovered branches.

Missing lines covered here:
  41, 86, 112-114, 122-123, 127-129, 141, 147-157, 172-177,
  186-216, 227, 243, 269, 271, 294-305, 318, 345-346
"""

from types import SimpleNamespace

import pytest

from services.formatting import (
    MAX_SENTENCE_DURATION_SECONDS,
    _group_sentences_into_paragraphs,
    _group_sentences_into_paragraphs_v2,
    _merge_segments_into_sentences,
    _paragraph_limits_for_language,
    _serialize_raw_segments,
    _split_long_sentence_segments,
    format_markdown_from_raw_segments,
    format_time,
)


def seg(text: str, start: float, end: float) -> SimpleNamespace:
    return SimpleNamespace(text=text, start=start, end=end)


# ---------------------------------------------------------------------------
# _split_long_sentence_segments
# ---------------------------------------------------------------------------

class TestSplitLongSentenceSegmentsExtended:
    def test_empty_list_returns_empty(self):
        # Line 41: push_chunk() called at loop end with no chunk_segments → early return
        result = _split_long_sentence_segments([])
        assert result == []

    def test_exceeds_word_count_triggers_split(self):
        # MAX_SENTENCE_WORDS = 80; first segment already exceeds it
        many_words = " ".join(["word"] * 85)
        s1 = seg(many_words, 0, 5)
        s2 = seg("extra", 5, 6)
        chunks = _split_long_sentence_segments([s1, s2])
        # s2 causes next_units > 80 → push_chunk fires before adding s2
        assert len(chunks) == 2

    def test_exceeds_max_segments_per_sentence(self):
        # MAX_SEGMENTS_PER_SENTENCE = 20 → 21 segments triggers split
        segs = [seg(f"w{i}", i * 0.5, (i + 1) * 0.5) for i in range(21)]
        chunks = _split_long_sentence_segments(segs)
        assert len(chunks) >= 2


# ---------------------------------------------------------------------------
# _merge_segments_into_sentences
# ---------------------------------------------------------------------------

class TestMergeSegmentsIntoSentencesExtended:
    def test_empty_input_returns_empty(self):
        # Line 86: if not all_segments: return []
        result = _merge_segments_into_sentences([])
        assert result == []

    def test_empty_segment_skipped_during_sentence(self):
        # Lines 127-129: empty text while current_text_parts non-empty →
        # seg appended to current_segments but not text_parts
        segs = [
            seg("Start of", 0, 1),
            seg("", 1, 2),       # empty mid-sentence → line 128
            seg("sentence.", 2, 3),
        ]
        result = _merge_segments_into_sentences(segs)
        assert len(result) >= 1
        combined = " ".join(r["text"] for r in result)
        assert "Start of" in combined
        assert "sentence" in combined

    def test_early_split_empty_after_triggers_continue(self):
        # Line 141: early split fires but after="" → if not after: continue
        # Segment ". " starts with period → early_split_pos = 1,
        # after = text[1:].strip() = ""
        segs = [
            seg("Previous sentence", 0, 1),
            seg(". ", 1, 2),      # early split, after="" → line 141
            seg("Next sentence.", 2, 3),
        ]
        result = _merge_segments_into_sentences(segs)
        assert len(result) >= 1

    def test_late_split_sets_carryover(self):
        # Lines 147-157: late_split_pos > 0, before flushed, after set as carryover
        # "This is a sentence. ok" — "ok" is 1 word after last punct → late split
        segs = [
            seg("This is a sentence. ok", 0, 2),
        ]
        result = _merge_segments_into_sentences(segs)
        # The sentence and carryover should appear in result
        assert len(result) >= 1
        combined = " ".join(r["text"] for r in result)
        assert "This is a sentence" in combined

    def test_carryover_text_merged_with_next_segment(self):
        # Lines 122-123: carryover_text from late split prepended to next seg text
        # seg1 triggers late split → carryover_text = "carry"
        # seg2 picks up carryover → text = "carry words here."
        segs = [
            seg("First sentence. carry", 0, 1),   # late split, carryover="carry"
            seg("words here.", 1, 2),              # lines 122-123 fire
        ]
        result = _merge_segments_into_sentences(segs)
        combined = " ".join(r["text"] for r in result)
        assert "carry" in combined
        assert "words here" in combined

    def test_carryover_at_end_appended_to_merged(self):
        # Lines 172-177: after loop, carryover_text.strip() non-empty
        # Only one segment, it triggers late split → carryover set → lines 172-177
        segs = [
            seg("This is it. carry", 0, 1),
        ]
        result = _merge_segments_into_sentences(segs)
        combined = " ".join(r["text"] for r in result)
        assert "carry" in combined

    def test_multi_chunk_flush_triggers_chunk_loop(self):
        # Lines 112-114: flush_sentence calls _split_long_sentence_segments
        # which returns > 1 chunk → each chunk appended individually.
        # "part two." triggers early split (period after 2-word "part two"),
        # total duration 0+13+14=27s > 24s → splits into 2 chunks
        segs = [
            seg("Part one", 0, 13),     # 13s
            seg("part two.", 13, 27),   # 14s; total 27s > MAX_SENTENCE_DURATION_SECONDS
        ]
        result = _merge_segments_into_sentences(segs)
        # The long sentence is split by the safety net into 2 chunks
        assert len(result) == 2
        assert "Part one" in result[0]["text"]
        assert "part two" in result[1]["text"]


# ---------------------------------------------------------------------------
# _group_sentences_into_paragraphs (v1) — lines 186-216
# ---------------------------------------------------------------------------

class TestGroupSentencesIntoParagraphsV1:
    def test_empty_returns_empty(self):
        result = _group_sentences_into_paragraphs([])
        assert result == []

    def test_single_sentence_becomes_paragraph(self):
        sentences = [{"start": 0, "end": 2, "text": "Hello world."}]
        result = _group_sentences_into_paragraphs(sentences)
        assert len(result) == 1
        assert result[0]["text"] == "Hello world."

    def test_time_gap_splits_into_separate_paragraphs(self):
        sentences = [
            {"start": 0, "end": 2, "text": "First."},
            {"start": 10, "end": 12, "text": "Second."},   # gap = 8s > gap_seconds=2
        ]
        result = _group_sentences_into_paragraphs(sentences, gap_seconds=2.0)
        assert len(result) == 2
        assert "First." in result[0]["text"]
        assert "Second." in result[1]["text"]

    def test_max_chars_splits_paragraph(self):
        sentences = [
            {"start": 0, "end": 1, "text": "A" * 300},
            {"start": 1, "end": 2, "text": "B" * 300},
        ]
        result = _group_sentences_into_paragraphs(sentences, max_chars=400)
        assert len(result) == 2

    def test_close_sentences_merged(self):
        sentences = [
            {"start": 0, "end": 1, "text": "One."},
            {"start": 1, "end": 2, "text": "Two."},
        ]
        result = _group_sentences_into_paragraphs(sentences, gap_seconds=5.0)
        assert len(result) == 1
        assert "One." in result[0]["text"]
        assert "Two." in result[0]["text"]

    def test_multiple_sentences_grouped(self):
        sentences = [
            {"start": 0, "end": 1, "text": "Alpha."},
            {"start": 1.5, "end": 2.5, "text": "Beta."},
            {"start": 3, "end": 4, "text": "Gamma."},
        ]
        result = _group_sentences_into_paragraphs(sentences, gap_seconds=2.0)
        assert len(result) == 1
        assert "Alpha." in result[0]["text"]


# ---------------------------------------------------------------------------
# _paragraph_limits_for_language — CJK path (line 227)
# ---------------------------------------------------------------------------

class TestParagraphLimitsForLanguage:
    def test_cjk_zh_returns_short_limits(self):
        # Line 227: is_cjk_language("zh") → True → return 260, 28.0
        max_chars, max_dur = _paragraph_limits_for_language("zh")
        assert max_chars == 260
        assert max_dur == 28.0

    def test_cjk_ja_returns_short_limits(self):
        max_chars, max_dur = _paragraph_limits_for_language("ja")
        assert max_chars == 260
        assert max_dur == 28.0

    def test_english_returns_longer_limits(self):
        max_chars, max_dur = _paragraph_limits_for_language("en")
        assert max_chars == 520
        assert max_dur == 36.0

    def test_unknown_lang_returns_longer_limits(self):
        max_chars, max_dur = _paragraph_limits_for_language("unknown")
        assert max_chars == 520


# ---------------------------------------------------------------------------
# _group_sentences_into_paragraphs_v2 — lines 243, 269, 271
# ---------------------------------------------------------------------------

class TestGroupSentencesIntoParagraphsV2Extended:
    def test_empty_returns_empty(self):
        # Line 243: if not sentences: return []
        result = _group_sentences_into_paragraphs_v2(
            [], max_chars=500, gap_seconds=2.0, max_duration_seconds=30
        )
        assert result == []

    def test_max_chars_exceeds_split(self):
        # Line 269: elif cur_parts and len(candidate) > max_chars → should_split = True
        sentences = [
            {"start": 0, "end": 1, "text": "A" * 300},
            {"start": 1, "end": 2, "text": "B" * 300},
        ]
        result = _group_sentences_into_paragraphs_v2(
            sentences, max_chars=400, gap_seconds=100.0, max_duration_seconds=100
        )
        assert len(result) == 2

    def test_max_duration_exceeds_split(self):
        # Line 271: elif cur_parts and next_duration > max_duration_seconds → should_split
        sentences = [
            {"start": 0, "end": 20, "text": "First long sentence."},
            {"start": 20, "end": 40, "text": "Second sentence."},
        ]
        result = _group_sentences_into_paragraphs_v2(
            sentences, max_chars=500, gap_seconds=100.0, max_duration_seconds=25
        )
        # next_duration = 40 - 0 = 40 > 25 → split
        assert len(result) == 2


# ---------------------------------------------------------------------------
# _serialize_raw_segments — lines 294-305
# ---------------------------------------------------------------------------

class TestSerializeRawSegments:
    def test_empty_list_returns_empty(self):
        assert _serialize_raw_segments([]) == []

    def test_none_returns_empty(self):
        assert _serialize_raw_segments(None) == []

    def test_converts_segment_objects_to_dicts(self):
        segs = [
            SimpleNamespace(start=0.0, end=2.5, text="Hello"),
            SimpleNamespace(start=2.5, end=5.0, text="World"),
        ]
        result = _serialize_raw_segments(segs)
        assert len(result) == 2
        assert result[0] == {"start": 0.0, "end": 2.5, "duration": 2.5, "text": "Hello"}
        assert result[1] == {"start": 2.5, "end": 5.0, "duration": 2.5, "text": "World"}

    def test_handles_none_start_end(self):
        segs = [SimpleNamespace(start=None, end=None, text="Test")]
        result = _serialize_raw_segments(segs)
        assert result[0]["start"] == 0.0
        assert result[0]["end"] == 0.0
        assert result[0]["duration"] == 0.0

    def test_strips_segment_text(self):
        segs = [SimpleNamespace(start=0.0, end=1.0, text="  spaced  ")]
        result = _serialize_raw_segments(segs)
        assert result[0]["text"] == "spaced"

    def test_duration_cannot_be_negative(self):
        # end < start → duration = max(end - start, 0.0) = 0.0
        segs = [SimpleNamespace(start=5.0, end=3.0, text="backwards")]
        result = _serialize_raw_segments(segs)
        assert result[0]["duration"] == 0.0


# ---------------------------------------------------------------------------
# format_time — HH:MM:SS branch (line 318)
# ---------------------------------------------------------------------------

class TestFormatTime:
    def test_minutes_and_seconds(self):
        assert format_time(65) == "01:05"

    def test_zero(self):
        assert format_time(0) == "00:00"

    def test_hours_path_returns_hhmmss(self):
        # Line 318: hours > 0 → f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        assert format_time(3661) == "01:01:01"
        assert format_time(3600) == "01:00:00"
        assert format_time(7322) == "02:02:02"

    def test_exactly_one_hour(self):
        assert format_time(3600) == "01:00:00"


# ---------------------------------------------------------------------------
# format_markdown_from_raw_segments — supplemental branch coverage
# ---------------------------------------------------------------------------

class TestFormatMarkdownFromRawSegmentsExtended:
    def test_bad_segment_caught_and_skipped(self):
        # Lines 345-346: except Exception: continue — bad start value skipped
        raw_segments = [
            {"start": "not-a-float", "end": 2.0, "text": "Good segment."},
            {"start": 0.0, "end": 1.0, "text": "Another good one."},
        ]
        md = format_markdown_from_raw_segments(raw_segments)
        assert isinstance(md, str)
        # Only the valid segment should appear
        assert "Another good one." in md

    def test_cjk_language_uses_shorter_paragraph_limits(self):
        # Exercises _paragraph_limits_for_language("zh") returning (260, 28.0)
        raw_segments = [
            {"start": 0.0, "end": 2.0, "text": "你好世界。"},
        ]
        md = format_markdown_from_raw_segments(raw_segments, detected_language="zh")
        assert "**[00:00]**" in md
        assert "你好世界" in md

    def test_long_video_uses_hhmmss_format(self):
        # Para starting at > 3600s → format_time returns HH:MM:SS (line 318)
        raw_segments = [
            {"start": 3661.0, "end": 3665.0, "text": "Late content."},
        ]
        md = format_markdown_from_raw_segments(raw_segments)
        assert "01:01:01" in md

    def test_empty_raw_segments_returns_empty_string(self):
        md = format_markdown_from_raw_segments([])
        assert md == ""
