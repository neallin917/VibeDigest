"""
Keypoint timestamp matching module.

This module handles matching keypoints to transcript segments
to provide timestamp anchors for video navigation.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from stop_words import get_stop_words

from utils.language_utils import normalize_lang_code

logger = logging.getLogger(__name__)


class KeypointMatcher:
    """
    Matches summary keypoints to transcript segments for timestamp injection.

    Uses token-based matching with support for both CJK and Western languages.
    """

    def __init__(self, config: Any):
        """
        Initialize the KeypointMatcher.

        Args:
            config: SummarizerConfig instance
        """
        self.config = config

    def parse_script_raw_payload(
        self, script_raw_json: Optional[str]
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Parse raw script JSON to extract language and segments.

        Args:
            script_raw_json: JSON string containing script data

        Returns:
            Tuple of (language_code, list_of_segments)
        """
        if not script_raw_json:
            return "unknown", []
        try:
            payload = json.loads(script_raw_json)
        except Exception:
            return "unknown", []
        if not isinstance(payload, dict):
            return "unknown", []
        lang = normalize_lang_code(payload.get("language"))
        segs = payload.get("segments", [])
        if not isinstance(segs, list):
            return lang, []
        out = []
        for s in segs:
            if not isinstance(s, dict):
                continue
            try:
                start = float(s.get("start", 0))
                end = float(s.get("end", start))
                text = str(s.get("text", "")).strip()
                if text:
                    out.append({"start": start, "end": end, "text": text})
            except Exception:
                continue
        return lang, out

    def inject_keypoint_timestamps(
        self, summary_obj: Dict[str, Any], segments: List[Dict[str, Any]], lang: str = "en"
    ) -> Dict[str, Any]:
        """
        Inject timestamps into keypoints based on segment matching.

        Args:
            summary_obj: Summary dict containing keypoints
            segments: List of transcript segments with start/end times
            lang: Language code for tokenization

        Returns:
            Summary dict with timestamp annotations
        """
        if not isinstance(summary_obj, dict):
            return summary_obj
        kps = summary_obj.get("keypoints", [])
        if not isinstance(kps, list) or not segments:
            return summary_obj

        seg_cache = []
        for s in segments:
            seg_cache.append(
                (s, self._tokenize_for_match(s.get("text", ""), lang=lang))
            )

        for kp in kps:
            if not isinstance(kp, dict):
                continue
            if (
                isinstance(kp.get("startSeconds"), (int, float))
                and kp.get("startSeconds") is not None
            ):
                continue
            query = self._build_keypoint_query(kp)
            if not query:
                continue

            q_tokens = self._tokenize_for_match(query, lang=lang)
            scores = []
            for i, (seg, seg_tokens) in enumerate(seg_cache):
                scores.append(
                    self._score_segment_match(
                        query=query,
                        query_tokens=q_tokens,
                        seg_text=seg.get("text", ""),
                        seg_tokens=seg_tokens,
                    )
                )

            if not scores:
                continue
            best_idx, best_score = -1, -1e9
            for i, sc in enumerate(scores):
                if sc > best_score:
                    best_score, best_idx = sc, i

            if best_idx == -1 or best_score < self.config.summary_match_threshold:
                continue

            start_idx, end_idx = best_idx, best_idx
            expansion_ratio = 0.6
            min_expansion_score = self.config.summary_match_threshold * 0.8

            while start_idx > 0 and (
                scores[start_idx - 1] >= best_score * expansion_ratio
                or scores[start_idx - 1] > min_expansion_score
            ):
                start_idx -= 1
            while end_idx < len(segments) - 1 and (
                scores[end_idx + 1] >= best_score * expansion_ratio
                or scores[end_idx + 1] > min_expansion_score
            ):
                end_idx += 1

            try:
                kp["startSeconds"] = float(segments[start_idx].get("start", 0.0))
                kp["endSeconds"] = float(
                    segments[end_idx].get("end", kp["startSeconds"]) or 0.0
                )
            except Exception:
                continue

        try:
            summary_obj["version"] = max(int(summary_obj.get("version", 1) or 1), 2)
        except Exception:
            summary_obj["version"] = 2
        return summary_obj

    @staticmethod
    def _build_keypoint_query(kp: Dict[str, Any]) -> str:
        """Build a search query from keypoint data."""
        if not isinstance(kp, dict):
            return ""
        evidence = str(kp.get("evidence", "")).strip()
        title = str(kp.get("title", "")).strip()

        # If evidence exists, use it primarily
        if len(evidence) > 5:
            return f"{evidence} {title}".strip()

        # Fallback: use title + trimmed detail
        detail = str(kp.get("detail", "")).strip()[:100]
        return f"{title} {detail}".strip()

    @staticmethod
    def _is_cjk_text(text: str) -> bool:
        """Check if text contains CJK characters."""
        if not text:
            return False
        return any("\u4e00" <= ch <= "\u9fff" for ch in text)

    @staticmethod
    def _normalize_for_match(text: str) -> str:
        """Normalize text for matching."""
        s = (text or "").lower()
        s = re.sub(r"[^\w\u4e00-\u9fff]+", " ", s, flags=re.UNICODE)
        return re.sub(r"\s+", " ", s).strip()

    def _tokenize_for_match(self, text: str, lang: str = "en") -> Set[str]:
        """
        Tokenize text for matching.

        Uses bigrams for CJK text and word tokens (minus stop words) for others.
        """
        s = self._normalize_for_match(text)
        if not s:
            return set()
        if self._is_cjk_text(s):
            compact = s.replace(" ", "")
            if len(compact) <= 1:
                return {compact} if compact else set()
            return {compact[i : i + 2] for i in range(len(compact) - 1)}

        # Dynamic stop words based on language
        try:
            target = lang.lower() if lang else "en"
            if target == "unknown":
                target = "en"
            stop_words = set(get_stop_words(target))
        except Exception:
            # Fallback to English stop words
            stop_words = {
                "the", "be", "to", "of", "and", "a", "in", "that", "have",
                "i", "it", "for", "not", "on", "with", "he", "as", "you",
                "do", "at", "this", "but", "his", "by", "from", "they",
                "we", "say", "her", "she", "or", "an", "will", "my", "one",
                "all", "would", "there", "their", "what", "so", "up", "out",
                "if", "about", "who", "get", "which", "go", "me", "when",
                "make", "can", "like", "time", "no", "just", "him", "know",
                "take", "people", "into", "year", "your", "good", "some",
                "could", "them", "see", "other", "than", "then", "now",
                "look", "only", "come", "its", "over", "think", "also",
                "back", "after", "use", "two", "how", "our", "work", "first",
                "well", "way", "even", "new", "want", "because", "any",
                "these", "give", "day", "most", "us", "is", "are", "was",
                "were", "has", "had",
            }

        return {t for t in s.split(" ") if len(t) >= 2 and t not in stop_words}

    def _score_segment_match(
        self, *, query: str, query_tokens: Set[str], seg_text: str, seg_tokens: Set[str]
    ) -> float:
        """
        Score how well a segment matches a keypoint query.

        Higher scores indicate better matches.
        """
        if not seg_text:
            return 0.0
        qn, sn = self._normalize_for_match(query), self._normalize_for_match(seg_text)
        if not qn or not sn:
            return 0.0
        score = 0.0
        if len(qn) >= 8 and qn in sn:
            score += 30.0
        if query_tokens and seg_tokens:
            inter = len(query_tokens & seg_tokens)
            score += 12.0 * (inter / max(1, len(query_tokens))) + min(8.0, float(inter))
        score -= min(3.0, len(sn) / 280.0)
        return score
