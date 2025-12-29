import os
import logging
from typing import Optional
import re
import json
try:
    from langfuse.openai import OpenAI
except ImportError:
    from openai import OpenAI

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Transcript readability formatting (sentence merging + safeguards)
# ---------------------------------------------------------------------------

# Hard safeguards so we never return a single, video-length "sentence" when
# captions don't include punctuation (common with auto-generated transcripts).
MAX_SENTENCE_DURATION_SECONDS = 24.0  # keep chunks short for navigation
MAX_SENTENCE_WORDS = 80
MAX_SEGMENTS_PER_SENTENCE = 20

SENTENCE_PUNCTUATION_REGEX = re.compile(r"[.!?\u3002\uff01\uff1f\u203c\u2047\u2048]")
WHITESPACE_GLOBAL_REGEX = re.compile(r"\s+")
PUNCTUATION_OR_SPACE_REGEX = re.compile(r"[\s,;!?]")
DIGIT_REGEX = re.compile(r"\d")
NON_PERIOD_SENTENCE_ENDING_REGEX = re.compile(r"[!?\u3002\uff01\uff1f\u203c\u2047\u2048]$")

# Common patterns to avoid treating "." as sentence-ending for URLs/abbrevs/extensions.
COMMON_TLDS = {
    "com", "org", "net", "edu", "gov", "co", "io", "ai", "dev",
    "txt", "pdf", "jpg", "png", "gif", "doc", "zip", "html", "js", "ts"
}
COMMON_ABBREVS = {"dr", "mr", "mrs", "ms", "vs", "etc", "inc", "ltd", "jr", "sr"}


def _count_words_or_units(text: str) -> int:
    """
    Count "units" for length bounding.
    - If text has spaces, count words.
    - Otherwise (e.g. CJK without spaces), approximate by counting non-space characters.
    """
    if not text:
        return 0
    s = text.strip()
    if not s:
        return 0
    if " " in s or "\t" in s or "\n" in s:
        return len([w for w in re.split(r"\s+", s) if w])
    # No spaces -> likely CJK; count visible chars as rough units
    return len([ch for ch in s if not ch.isspace()])


def _is_sentence_ending_period(text: str, period_index: int) -> bool:
    before = text[period_index - 1] if period_index - 1 >= 0 else ""
    after = text[period_index + 1] if period_index + 1 < len(text) else ""

    # Decimal number: digit before and digit after (e.g., "2.2", "3.14")
    if before and after and DIGIT_REGEX.search(before) and DIGIT_REGEX.search(after):
        return False

    # Check for common TLDs and file extensions (e.g., ".com", ".org", ".txt")
    after_period = text[period_index + 1: period_index + 5].lower()
    for pattern in COMMON_TLDS:
        if after_period.startswith(pattern):
            char_after_pattern = text[period_index + 1 + len(pattern): period_index + 2 + len(pattern)]
            if not char_after_pattern or PUNCTUATION_OR_SPACE_REGEX.search(char_after_pattern):
                return False

    # Common abbreviations (check 1-3 chars before period)
    before_period = text[max(0, period_index - 3): period_index].lower()
    for abbrev in COMMON_ABBREVS:
        if before_period.endswith(abbrev):
            return False

    return True


def _ends_with_sentence(text: str) -> bool:
    trimmed = (text or "").strip()
    if not trimmed:
        return False

    # Non-period sentence endings
    if NON_PERIOD_SENTENCE_ENDING_REGEX.search(trimmed):
        return True

    # Period - verify it's truly sentence-ending
    if trimmed.endswith("."):
        return _is_sentence_ending_period(trimmed, len(trimmed) - 1)

    return False


def _find_true_sentence_punct_positions(text: str) -> list[int]:
    """Return indices of punctuation that are truly sentence-ending."""
    trimmed = (text or "").strip()
    if not trimmed:
        return []
    positions: list[int] = []
    for m in SENTENCE_PUNCTUATION_REGEX.finditer(trimmed):
        idx = m.start()
        ch = trimmed[idx]
        if ch != ".":
            positions.append(idx)
        else:
            if _is_sentence_ending_period(trimmed, idx):
                positions.append(idx)
    return positions


def _find_early_punctuation_split(text: str) -> int:
    """
    Find sentence-ending punctuation near the beginning of text (within first 2 words/units).
    Returns the index position right after the punctuation, or -1 if none found.
    """
    trimmed = (text or "").strip()
    if not trimmed:
        return -1
    positions = _find_true_sentence_punct_positions(trimmed)
    if not positions:
        return -1
    first_idx = positions[0]
    before = trimmed[:first_idx].strip()
    units = _count_words_or_units(before)
    if 0 <= units <= 2:
        return first_idx + 1
    return -1


def _find_late_punctuation_split(text: str) -> int:
    """
    Find sentence-ending punctuation near the end of text (within last 2 words/units).
    Returns the index position right after the punctuation, or -1 if none found.
    """
    trimmed = (text or "").strip()
    if not trimmed:
        return -1
    positions = _find_true_sentence_punct_positions(trimmed)
    if not positions:
        return -1
    last_idx = positions[-1]
    after = trimmed[last_idx + 1:].strip()
    units = _count_words_or_units(after)
    if 1 <= units <= 2:
        return last_idx + 1
    return -1


def _split_long_sentence_segments(segments: list) -> list[dict]:
    """
    Split an over-long sentence (represented by a list of OpenAI segment objects) into bounded chunks.
    Chunks are split on segment boundaries to preserve timestamps.
    """
    chunks: list[dict] = []
    chunk_segments = []
    chunk_units = 0
    chunk_duration = 0.0
    chunk_start = None

    def push_chunk():
        nonlocal chunk_segments, chunk_units, chunk_duration, chunk_start
        if not chunk_segments:
            return
        text = " ".join([(getattr(s, "text", "") or "").strip() for s in chunk_segments]).strip()
        text = WHITESPACE_GLOBAL_REGEX.sub(" ", text).strip()
        start = chunk_start if chunk_start is not None else float(getattr(chunk_segments[0], "start", 0.0) or 0.0)
        end = float(getattr(chunk_segments[-1], "end", start) or start)
        chunks.append({"start": start, "end": end, "segments": list(chunk_segments), "text": text})
        chunk_segments = []
        chunk_units = 0
        chunk_duration = 0.0
        chunk_start = None

    for seg in segments:
        seg_text = (getattr(seg, "text", "") or "").strip()
        seg_units = _count_words_or_units(seg_text)
        seg_start = float(getattr(seg, "start", 0.0) or 0.0)
        seg_end = float(getattr(seg, "end", seg_start) or seg_start)
        seg_duration = max(seg_end - seg_start, 0.0)

        next_duration = chunk_duration + seg_duration
        next_units = chunk_units + seg_units
        next_seg_count = len(chunk_segments) + 1

        exceeds_duration = bool(chunk_segments) and next_duration > MAX_SENTENCE_DURATION_SECONDS
        exceeds_units = bool(chunk_segments) and next_units > MAX_SENTENCE_WORDS
        exceeds_segments = bool(chunk_segments) and next_seg_count > MAX_SEGMENTS_PER_SENTENCE

        if exceeds_duration or exceeds_units or exceeds_segments:
            push_chunk()

        if chunk_start is None:
            chunk_start = seg_start
        chunk_segments.append(seg)
        chunk_units += seg_units
        chunk_duration += seg_duration

    push_chunk()
    return chunks


def _merge_segments_into_sentences(all_segments: list) -> list[dict]:
    """
    Merge OpenAI Whisper segments into sentence-like chunks for better readability.
    Returns list of dicts: {start, end, text, segments}
    """
    if not all_segments:
        return []

    merged: list[dict] = []
    current_text_parts: list[str] = []
    current_segments: list = []
    carryover_text = ""
    sentence_start = None

    def flush_sentence():
        nonlocal current_text_parts, current_segments, sentence_start
        if not current_text_parts and not current_segments:
            return
        text = " ".join([p for p in current_text_parts if p]).strip()
        text = WHITESPACE_GLOBAL_REGEX.sub(" ", text).strip()
        if not text:
            current_text_parts = []
            current_segments = []
            sentence_start = None
            return
        start = sentence_start if sentence_start is not None else float(getattr(current_segments[0], "start", 0.0) or 0.0)
        end = float(getattr(current_segments[-1], "end", start) or start)
        # Safety net: split extreme sentences by boundaries
        chunks = _split_long_sentence_segments(current_segments)
        if len(chunks) <= 1:
            merged.append({"start": start, "end": end, "text": text, "segments": list(current_segments)})
        else:
            for c in chunks:
                if c["text"]:
                    merged.append(c)
        current_text_parts = []
        current_segments = []
        sentence_start = None

    for seg in all_segments:
        text = (getattr(seg, "text", "") or "").strip()
        if carryover_text:
            text = (carryover_text + " " + text).strip()
            carryover_text = ""

        # Skip empty segments, but keep timing continuity by including seg if we're in a sentence
        if not text:
            if current_text_parts:
                current_segments.append(seg)
            continue

        # Early punctuation: ". You should" should attach to previous sentence
        early_split_pos = _find_early_punctuation_split(text)
        if early_split_pos > 0 and current_text_parts:
            before = text[:early_split_pos].strip()
            after = text[early_split_pos:].strip()
            if before:
                current_text_parts.append(before)
            current_segments.append(seg)
            flush_sentence()
            if not after:
                continue
            text = after

        # Late punctuation: split when punctuation appears near end (so trailing 1-2 words carry to next sentence)
        late_split_pos = _find_late_punctuation_split(text)
        if late_split_pos > 0:
            before = text[:late_split_pos].strip()
            after = text[late_split_pos:].strip()
            if sentence_start is None:
                sentence_start = float(getattr(seg, "start", 0.0) or 0.0)
            if before:
                current_text_parts.append(before)
            current_segments.append(seg)
            flush_sentence()
            if after:
                carryover_text = after
            continue

        # Add segment to current sentence
        if sentence_start is None:
            sentence_start = float(getattr(seg, "start", 0.0) or 0.0)
        current_text_parts.append(text)
        current_segments.append(seg)

        if _ends_with_sentence(text):
            flush_sentence()

    # Remaining
    if current_text_parts:
        flush_sentence()
    if carryover_text.strip():
        merged.append({"start": float(getattr(all_segments[-1], "start", 0.0) or 0.0),
                       "end": float(getattr(all_segments[-1], "end", 0.0) or 0.0),
                       "text": carryover_text.strip(),
                       "segments": [all_segments[-1]]})
    return merged


def _group_sentences_into_paragraphs(sentences: list[dict], max_chars: int = 550, gap_seconds: float = 2.0) -> list[dict]:
    """
    Group sentence chunks into paragraphs based on time gaps and character budget.
    Returns list of dicts: {start, end, text}
    """
    if not sentences:
        return []
    paragraphs: list[dict] = []
    cur_start = sentences[0]["start"]
    cur_end = sentences[0]["end"]
    cur_parts: list[str] = []

    def push_para():
        nonlocal cur_start, cur_end, cur_parts
        txt = " ".join(cur_parts).strip()
        txt = WHITESPACE_GLOBAL_REGEX.sub(" ", txt).strip()
        if txt:
            paragraphs.append({"start": cur_start, "end": cur_end, "text": txt})
        cur_parts = []

    for s in sentences:
        gap = float(s["start"]) - float(cur_end)
        candidate = (" ".join(cur_parts + [s["text"]])).strip()
        if cur_parts and (gap > gap_seconds or len(candidate) > max_chars):
            push_para()
            cur_start = s["start"]
            cur_end = s["end"]
            cur_parts = [s["text"]]
        else:
            if not cur_parts:
                cur_start = s["start"]
            cur_parts.append(s["text"])
            cur_end = s["end"]

    push_para()
    return paragraphs

def _is_cjk_language(lang: str) -> bool:
    """Best-effort check for CJK-like languages where whitespace is sparse."""
    if not lang:
        return False
    s = str(lang).lower()
    return any(k in s for k in ("zh", "chinese", "ja", "japanese", "ko", "korean"))


def _paragraph_limits_for_language(lang: str) -> tuple[int, float]:
    """
    Tuned readability limits:
    - CJK: shorter paragraphs feel much more readable on screen
    - Non-CJK: can be longer
    Returns: (max_chars, max_duration_seconds)
    """
    if _is_cjk_language(lang):
        return 260, 28.0
    return 520, 36.0


def _group_sentences_into_paragraphs_v2(
    sentences: list[dict],
    *,
    max_chars: int,
    gap_seconds: float,
    max_duration_seconds: float,
) -> list[dict]:
    """
    Improved paragraph grouping with an additional max-duration bound.
    This avoids giant paragraphs for continuous speech with low gaps.
    """
    if not sentences:
        return []
    paragraphs: list[dict] = []
    cur_start = float(sentences[0]["start"])
    cur_end = float(sentences[0]["end"])
    cur_parts: list[str] = []

    def push_para():
        nonlocal cur_start, cur_end, cur_parts
        txt = " ".join(cur_parts).strip()
        txt = WHITESPACE_GLOBAL_REGEX.sub(" ", txt).strip()
        if txt:
            paragraphs.append({"start": cur_start, "end": cur_end, "text": txt})
        cur_parts = []

    for s in sentences:
        s_start = float(s["start"])
        s_end = float(s["end"])
        gap = s_start - cur_end
        candidate = (" ".join(cur_parts + [s["text"]])).strip()
        next_end = s_end
        next_duration = next_end - cur_start

        should_split = False
        if cur_parts and gap > gap_seconds:
            should_split = True
        elif cur_parts and len(candidate) > max_chars:
            should_split = True
        elif cur_parts and next_duration > max_duration_seconds:
            should_split = True

        if should_split:
            push_para()
            cur_start = s_start
            cur_end = s_end
            cur_parts = [s["text"]]
        else:
            if not cur_parts:
                cur_start = s_start
            cur_parts.append(s["text"])
            cur_end = s_end

    push_para()
    return paragraphs

def _serialize_raw_segments(all_segments: list) -> list[dict]:
    """
    Convert OpenAI segment objects into JSON-serializable dicts.
    We intentionally store a minimal, stable shape for future re-formatting:
    {start, end, duration, text}
    """
    raw: list[dict] = []
    for seg in all_segments or []:
        start = float(getattr(seg, "start", 0.0) or 0.0)
        end = float(getattr(seg, "end", start) or start)
        text = (getattr(seg, "text", "") or "").strip()
        raw.append({
            "start": start,
            "end": end,
            "duration": max(end - start, 0.0),
            "text": text,
        })
    return raw


def format_markdown_from_raw_segments(raw_segments: list[dict], detected_language: str = "unknown") -> str:
    """
    Public helper: format transcript markdown from stored raw segments (JSON).
    This enables re-formatting without re-transcribing.
    """
    # NOTE: Keep the transcript content clean and UI-friendly.
    # The frontend already shows "original script language", so we avoid repeating
    # "Detected Language" and "Transcription Content" headings inside the markdown.
    transcript_lines: list[str] = []

    # Convert raw dicts to a lightweight object-like interface expected by the merge logic.
    class _Seg:
        __slots__ = ("start", "end", "text")
        def __init__(self, start: float, end: float, text: str):
            self.start = start
            self.end = end
            self.text = text

    all_segments = []
    for s in raw_segments or []:
        try:
            start = float(s.get("start", 0.0) or 0.0)
            end = float(s.get("end", start) or start)
            text = str(s.get("text", "") or "")
            all_segments.append(_Seg(start, end, text))
        except Exception:
            continue

    sentences = _merge_segments_into_sentences(all_segments)
    max_chars, max_dur = _paragraph_limits_for_language(detected_language)
    paragraphs = _group_sentences_into_paragraphs_v2(
        sentences,
        max_chars=max_chars,
        gap_seconds=2.0,
        max_duration_seconds=max_dur,
    )
    for para in paragraphs:
        start_time = Transcriber()._format_time(float(para["start"]))  # reuse existing formatting
        transcript_lines.append(f"**[{start_time}]**")
        # NOTE: A single '\n' is treated as a space in Markdown. Add a blank line so
        # timestamp and text become separate blocks for readability.
        transcript_lines.append("")
        transcript_lines.append(para["text"])
        transcript_lines.append("")

    return "\n".join(transcript_lines)

from config import settings

class Transcriber:
    """音频转录器，使用 OpenAI API 进行语音转文字"""
    
    def __init__(self, model_size: str = None):
        """
        初始化转录器
        
        Args:
            model_size: OpenAI 模型名称 (默认使用 config 中的配置)
        """
        self.model_name = model_size or settings.OPENAI_TRANSCRIPTION_MODEL
        self.client = None
        self.last_detected_language = None
        
    def _init_client(self):
        """延迟初始化 OpenAI 客户端"""
        if self.client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            base_url = os.getenv("OPENAI_BASE_URL")
            if not api_key:
                raise ValueError("未找到 OPENAI_API_KEY 环境变量")
            
            if base_url:
                self.client = OpenAI(api_key=api_key, base_url=base_url)
                logger.info(f"OpenAI 客户端初始化完成 (Base URL: {base_url})")
            else:
                self.client = OpenAI(api_key=api_key)
                logger.info("OpenAI 客户端初始化完成")
    
    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> str:
        """
        转录音频文件
        
        Args:
            audio_path: 音频文件路径
            language: 指定语言（可选，如果不指定则自动检测）
            
        Returns:
            转录文本（Markdown格式）
        """
        md, _, _ = await self.transcribe_with_raw(audio_path, language=language)
        return md

    async def transcribe_with_raw(self, audio_path: str, language: Optional[str] = None) -> tuple[str, str, str]:
        """
        Transcribe audio and also return a JSON payload of raw segments for future re-formatting.

        Returns:
            (markdown_text, raw_segments_json, detected_language)
        """
        try:
            # 检查文件是否存在
            if not os.path.exists(audio_path):
                raise Exception(f"音频文件不存在: {audio_path}")
            
            # 初始化客户端
            self._init_client()
            
            logger.info(f"开始使用 OpenAI 转录音频: {audio_path}")
            
            # 检查文件大小 (OpenAI 限制 25MB)
            file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
            logger.info(f"文件大小: {file_size_mb:.2f} MB")
            
            files_to_transcribe = []
            is_chunked = False
            
            if file_size_mb > 24.0: # 留一点余量
                logger.info("文件超过25MB，开始分片处理...")
                is_chunked = True
                files_to_transcribe = await self._split_audio(audio_path)
            else:
                files_to_transcribe = [(audio_path, 0.0)] # tuple of (path, start_offset)

            import asyncio
            all_segments = []
            detected_language = "unknown"
            
            try:
                for chunk_path, offset in files_to_transcribe:
                    logger.info(f"正在转录分片: {chunk_path} (偏移: {offset}s)")
                    
                    def _do_transcribe(path=chunk_path):
                        with open(path, "rb") as audio_file:
                            return self.client.audio.transcriptions.create(
                                model=self.model_name,
                                file=audio_file,
                                language=language,
                                response_format="verbose_json"
                            )
                    
                    transcript = await asyncio.to_thread(_do_transcribe)
                    
                    # 记录第一个分片的语言检测结果
                    if offset == 0.0:
                        detected_language = getattr(transcript, 'language', 'unknown')
                        self.last_detected_language = detected_language
                    
                    # 调整时间戳并合并
                    for segment in transcript.segments:
                        segment.start += offset
                        segment.end += offset
                        all_segments.append(segment)
                        
            finally:
                # 清理临时分片文件
                if is_chunked:
                    for chunk_path, _ in files_to_transcribe:
                        try:
                            if os.path.exists(chunk_path):
                                os.remove(chunk_path)
                        except Exception as e:
                            logger.warning(f"清理临时文件失败 {chunk_path}: {e}")

            logger.info(f"检测到的语言: {detected_language}")
            
            raw_payload = {
                "version": 1,
                "model": self.model_name,
                "language": detected_language,
                "segments": _serialize_raw_segments(all_segments),
            }
            raw_json = json.dumps(raw_payload, ensure_ascii=False)

            # 组装转录结果
            transcript_lines = []
            # NOTE: Keep transcript markdown free of redundant headings.
            # The UI already presents language metadata separately.

            # Readability-first formatting:
            # 1) Merge segments into sentence-like chunks using punctuation heuristics
            # 2) Safety-net split for overly long sentences (duration/words/segment count)
            # 3) Group sentences into paragraphs (time gap + char budget)
            sentences = _merge_segments_into_sentences(all_segments)
            max_chars, max_dur = _paragraph_limits_for_language(detected_language)
            paragraphs = _group_sentences_into_paragraphs_v2(
                sentences,
                max_chars=max_chars,
                gap_seconds=2.0,
                max_duration_seconds=max_dur,
            )

            for para in paragraphs:
                start_time = self._format_time(float(para["start"]))
                transcript_lines.append(f"**[{start_time}]**")
                transcript_lines.append("")
                transcript_lines.append(para["text"])
                transcript_lines.append("")
            
            transcript_text = "\n".join(transcript_lines)

            logger.info("转录完成")
            
            return transcript_text, raw_json, detected_language
            
        except Exception as e:
            logger.error(f"转录失败: {str(e)}")
            raise Exception(f"转录失败: {str(e)}")

    async def _split_audio(self, audio_path: str, chunk_length_ms: int = 10 * 60 * 1000) -> list:
        """
        使用 pydub 将音频切分为多个小片段
        
        Args:
            audio_path: 原音频路径
            chunk_length_ms: 切片长度（毫秒），默认10分钟
            
        Returns:
            list: [(chunk_path, start_offset_seconds), ...]
        """
        import asyncio
        from pydub import AudioSegment
        
        def _do_split():
            try:
                # pydub 依赖 ffmpeg，scripts/start.py 已检查
                audio = AudioSegment.from_file(audio_path)
                duration_ms = len(audio)
                chunks = []
                
                base_name = os.path.splitext(audio_path)[0]
                
                for i, start_ms in enumerate(range(0, duration_ms, chunk_length_ms)):
                    end_ms = min(start_ms + chunk_length_ms, duration_ms)
                    chunk = audio[start_ms:end_ms]
                    
                    chunk_filename = f"{base_name}_part{i}.mp3"
                    # 导出为 mp3 以减小体积
                    chunk.export(chunk_filename, format="mp3")
                    
                    chunks.append((chunk_filename, start_ms / 1000.0))
                
                return chunks
            except Exception as e:
                logger.error(f"音频切片失败: {e}")
                raise e

        # 这是一个耗时操作，放入线程池
        return await asyncio.to_thread(_do_split)
    
    def _format_time(self, seconds: float) -> str:
        """
        将秒数转换为时分秒格式 MM:SS 或 HH:MM:SS
        """
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        seconds = seconds % 60
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes:02d}:{seconds:02d}"
    
    def get_supported_languages(self) -> list:
        """
        获取支持的语言列表 (OpenAI Whisper 支持的常用语言)
        """
        return [
            "zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "ru",
            "ar", "hi", "th", "vi", "tr", "pl", "nl", "sv", "da", "no"
        ]
    
    def get_detected_language(self, transcript_text: Optional[str] = None) -> Optional[str]:
        """
        获取检测到的语言
        """
        # 如果有保存的语言，直接返回
        if self.last_detected_language:
            return self.last_detected_language
        
        # 如果提供了转录文本，尝试从中提取语言信息
        if transcript_text and "**Detected Language:**" in transcript_text:
            lines = transcript_text.split('\n')
            for line in lines:
                if "**Detected Language:**" in line:
                    lang = line.split(":")[-1].strip()
                    return lang
        
        return None
