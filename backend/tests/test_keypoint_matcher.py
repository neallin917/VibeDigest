"""Tests for services/summarizer/keypoint_matcher.py."""

import json
from types import SimpleNamespace

import pytest

from services.summarizer.keypoint_matcher import KeypointMatcher


@pytest.fixture
def config():
    return SimpleNamespace(summary_match_threshold=5.0)


@pytest.fixture
def matcher(config):
    return KeypointMatcher(config=config)


# ---------------------------------------------------------------------------
# parse_script_raw_payload
# ---------------------------------------------------------------------------

class TestParseScriptRawPayload:
    def test_none_input(self, matcher):
        lang, segs = matcher.parse_script_raw_payload(None)
        assert lang == "unknown"
        assert segs == []

    def test_empty_string(self, matcher):
        lang, segs = matcher.parse_script_raw_payload("")
        assert lang == "unknown"
        assert segs == []

    def test_invalid_json(self, matcher):
        lang, segs = matcher.parse_script_raw_payload("{not valid json")
        assert lang == "unknown"
        assert segs == []

    def test_non_dict_payload(self, matcher):
        lang, segs = matcher.parse_script_raw_payload(json.dumps([1, 2, 3]))
        assert lang == "unknown"
        assert segs == []

    def test_missing_segments_key(self, matcher):
        payload = json.dumps({"language": "en"})
        lang, segs = matcher.parse_script_raw_payload(payload)
        assert segs == []

    def test_non_list_segments(self, matcher):
        payload = json.dumps({"language": "en", "segments": "not a list"})
        lang, segs = matcher.parse_script_raw_payload(payload)
        assert segs == []

    def test_segments_with_non_dict_entries(self, matcher):
        payload = json.dumps({"language": "en", "segments": [None, 42, "string"]})
        _, segs = matcher.parse_script_raw_payload(payload)
        assert segs == []

    def test_segments_missing_text_skipped(self, matcher):
        payload = json.dumps({
            "language": "en",
            "segments": [{"start": 0.0, "end": 1.0, "text": ""}]
        })
        _, segs = matcher.parse_script_raw_payload(payload)
        assert segs == []

    def test_valid_payload(self, matcher):
        payload = json.dumps({
            "language": "en",
            "segments": [
                {"start": 0.0, "end": 1.5, "text": "Hello world"},
                {"start": 1.5, "end": 3.0, "text": "How are you"},
            ]
        })
        lang, segs = matcher.parse_script_raw_payload(payload)
        assert lang == "en"
        assert len(segs) == 2
        assert segs[0]["text"] == "Hello world"
        assert segs[0]["start"] == 0.0
        assert segs[1]["start"] == 1.5

    def test_valid_chinese_payload(self, matcher):
        payload = json.dumps({
            "language": "zh",
            "segments": [{"start": 0.0, "end": 2.0, "text": "你好世界"}]
        })
        lang, segs = matcher.parse_script_raw_payload(payload)
        assert lang == "zh"
        assert len(segs) == 1


# ---------------------------------------------------------------------------
# _is_cjk_text
# ---------------------------------------------------------------------------

class TestIsCjkText:
    def test_empty_string(self):
        assert KeypointMatcher._is_cjk_text("") is False

    def test_ascii_only(self):
        assert KeypointMatcher._is_cjk_text("hello world") is False

    def test_cjk_chars_present(self):
        assert KeypointMatcher._is_cjk_text("你好") is True

    def test_mixed_cjk_and_ascii(self):
        assert KeypointMatcher._is_cjk_text("hello 世界") is True


# ---------------------------------------------------------------------------
# _normalize_for_match
# ---------------------------------------------------------------------------

class TestNormalizeForMatch:
    def test_none_like(self):
        result = KeypointMatcher._normalize_for_match(None)
        assert result == ""

    def test_punctuation_stripping(self):
        result = KeypointMatcher._normalize_for_match("Hello, World!")
        # Non-word chars become spaces, then collapsed
        assert "," not in result
        assert "!" not in result

    def test_multiple_spaces_collapsed(self):
        result = KeypointMatcher._normalize_for_match("hello   world")
        assert "  " not in result
        assert result == "hello world"

    def test_lowercased(self):
        result = KeypointMatcher._normalize_for_match("UPPER CASE")
        assert result == "upper case"

    def test_cjk_preserved(self):
        result = KeypointMatcher._normalize_for_match("你好！世界")
        assert "你好" in result
        assert "世界" in result


# ---------------------------------------------------------------------------
# _tokenize_for_match
# ---------------------------------------------------------------------------

class TestTokenizeForMatch:
    def test_empty_string(self, matcher):
        assert matcher._tokenize_for_match("") == set()

    def test_whitespace_only(self, matcher):
        assert matcher._tokenize_for_match("   ") == set()

    def test_cjk_bigrams(self, matcher):
        tokens = matcher._tokenize_for_match("你好世界", lang="zh")
        # Should produce bigrams: 你好, 好世, 世界
        assert "你好" in tokens
        assert "好世" in tokens
        assert "世界" in tokens

    def test_english_stop_word_filtered(self, matcher):
        tokens = matcher._tokenize_for_match("the quick brown fox", lang="en")
        # "the" is a stop word; "quick", "brown", "fox" should remain
        assert "the" not in tokens
        assert "quick" in tokens
        assert "brown" in tokens

    def test_unknown_language_fallback(self, matcher):
        # Should fall back to English stop words without error
        tokens = matcher._tokenize_for_match("the quick brown fox", lang="unknown")
        assert "the" not in tokens
        assert "quick" in tokens

    def test_single_cjk_char(self, matcher):
        tokens = matcher._tokenize_for_match("你", lang="zh")
        assert "你" in tokens


# ---------------------------------------------------------------------------
# _build_keypoint_query
# ---------------------------------------------------------------------------

class TestBuildKeypointQuery:
    def test_non_dict_input(self):
        assert KeypointMatcher._build_keypoint_query("not a dict") == ""

    def test_long_evidence_used(self):
        kp = {"evidence": "This is long evidence text", "title": "My Title", "detail": "Some detail"}
        result = KeypointMatcher._build_keypoint_query(kp)
        assert "This is long evidence text" in result
        assert "My Title" in result

    def test_short_evidence_uses_detail_fallback(self):
        kp = {"evidence": "Hi", "title": "My Title", "detail": "Some detail text here"}
        result = KeypointMatcher._build_keypoint_query(kp)
        assert "My Title" in result
        assert "Some detail" in result

    def test_empty_kp(self):
        kp = {}
        result = KeypointMatcher._build_keypoint_query(kp)
        assert result == ""

    def test_evidence_exactly_5_chars_uses_fallback(self):
        kp = {"evidence": "12345", "title": "Title", "detail": "Some detail"}
        # len("12345") == 5, not > 5, so fallback path
        result = KeypointMatcher._build_keypoint_query(kp)
        assert "Title" in result

    def test_evidence_6_chars_used(self):
        kp = {"evidence": "123456", "title": "Title", "detail": "Some detail"}
        # len > 5, so evidence path
        result = KeypointMatcher._build_keypoint_query(kp)
        assert "123456" in result


# ---------------------------------------------------------------------------
# _score_segment_match
# ---------------------------------------------------------------------------

class TestScoreSegmentMatch:
    def test_empty_seg_text_returns_zero(self, matcher):
        score = matcher._score_segment_match(
            query="hello world",
            query_tokens={"hello", "world"},
            seg_text="",
            seg_tokens=set(),
        )
        assert score == 0.0

    def test_substring_match_bonus(self, matcher):
        # query normalized >= 8 chars and is substring of seg text → +30
        query = "the quick brown fox jumps"
        score = matcher._score_segment_match(
            query=query,
            query_tokens={"quick", "brown", "fox"},
            seg_text="the quick brown fox jumps over the lazy dog",
            seg_tokens={"quick", "brown", "fox", "lazy", "dog"},
        )
        assert score > 30.0

    def test_token_overlap_contributes(self, matcher):
        score_with_overlap = matcher._score_segment_match(
            query="machine learning model",
            query_tokens={"machine", "learning", "model"},
            seg_text="deep learning model training",
            seg_tokens={"deep", "learning", "model", "training"},
        )
        score_no_overlap = matcher._score_segment_match(
            query="machine learning model",
            query_tokens={"machine", "learning", "model"},
            seg_text="cats and dogs are pets",
            seg_tokens={"cats", "dogs", "pets"},
        )
        assert score_with_overlap > score_no_overlap

    def test_length_penalty_applied(self, matcher):
        short_seg = "quick brown"
        # Make a longer segment that should receive a penalty
        long_seg = " ".join(["word"] * 300)
        score_short = matcher._score_segment_match(
            query="quick brown fox",
            query_tokens={"quick", "brown", "fox"},
            seg_text=short_seg,
            seg_tokens={"quick", "brown"},
        )
        score_long = matcher._score_segment_match(
            query="quick brown fox",
            query_tokens={"quick", "brown", "fox"},
            seg_text=long_seg,
            seg_tokens={"quick", "brown", "word"},
        )
        # Long segment incurs more penalty
        assert score_long <= score_short + 3.0


# ---------------------------------------------------------------------------
# inject_keypoint_timestamps
# ---------------------------------------------------------------------------

class TestInjectKeypointTimestamps:
    def _make_segments(self):
        return [
            {"start": 0.0, "end": 5.0, "text": "Introduction to machine learning concepts"},
            {"start": 5.0, "end": 10.0, "text": "Deep learning and neural networks explained"},
            {"start": 10.0, "end": 15.0, "text": "Practical applications in the real world"},
        ]

    def test_non_dict_input_returned_as_is(self, matcher):
        result = matcher.inject_keypoint_timestamps("not a dict", [])
        assert result == "not a dict"

    def test_no_keypoints_returns_summary(self, matcher):
        summary = {"title": "Test", "keypoints": []}
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        assert result["title"] == "Test"

    def test_skip_if_start_seconds_already_set(self, matcher):
        summary = {
            "keypoints": [
                {"title": "Already tagged", "startSeconds": 3.0, "evidence": "some evidence text here"}
            ]
        }
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        # Should not be changed - still 3.0
        assert result["keypoints"][0]["startSeconds"] == 3.0

    def test_empty_segments_list(self, matcher):
        summary = {
            "keypoints": [
                {"title": "No match", "evidence": "some evidence for this keypoint"}
            ]
        }
        result = matcher.inject_keypoint_timestamps(summary, [])
        # No segments → keypoint not annotated
        assert "startSeconds" not in result["keypoints"][0]

    def test_score_below_threshold_no_annotation(self, config):
        # Very high threshold so nothing matches
        config.summary_match_threshold = 9999.0
        matcher = KeypointMatcher(config=config)
        summary = {
            "keypoints": [
                {"title": "Unmatched", "evidence": "completely unrelated content xyz"}
            ]
        }
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        assert "startSeconds" not in result["keypoints"][0]

    def test_successful_timestamp_injection(self, config):
        config.summary_match_threshold = 1.0
        matcher = KeypointMatcher(config=config)
        summary = {
            "keypoints": [
                {
                    "title": "Machine Learning",
                    "evidence": "Introduction to machine learning concepts"
                }
            ]
        }
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        kp = result["keypoints"][0]
        assert "startSeconds" in kp
        assert isinstance(kp["startSeconds"], float)
        assert "endSeconds" in kp

    def test_version_bumped_to_at_least_2(self, matcher):
        summary = {"version": 1, "keypoints": []}
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        assert result["version"] >= 2

    def test_version_set_when_missing(self, matcher):
        summary = {"keypoints": []}
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        assert result["version"] == 2

    def test_non_dict_keypoint_skipped(self, config):
        config.summary_match_threshold = 1.0
        matcher = KeypointMatcher(config=config)
        summary = {"keypoints": ["not a dict", None, 42]}
        # Should not raise
        result = matcher.inject_keypoint_timestamps(summary, self._make_segments())
        assert result is not None
