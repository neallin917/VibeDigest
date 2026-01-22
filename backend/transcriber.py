import os
import logging
from typing import Optional, List, Dict, Any, Tuple
import json
import asyncio
from config import settings
from utils.openai_client import get_openai_client
from utils.text_utils import (
    count_words_or_units,
    find_early_punctuation_split,
    find_late_punctuation_split,
    ends_with_sentence,
    WHITESPACE_GLOBAL_REGEX
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Transcript readability formatting (sentence merging + safeguards)
# ---------------------------------------------------------------------------

# Hard safeguards so we never return a single, video-length "sentence" when
# captions don't include punctuation (common with auto-generated transcripts).
MAX_SENTENCE_DURATION_SECONDS = 24.0  # keep chunks short for navigation
MAX_SENTENCE_WORDS = 80
MAX_SEGMENTS_PER_SENTENCE = 20

def _split_long_sentence_segments(segments: List[Any]) -> List[Dict[str, Any]]:
    """
    Split an over-long sentence (represented by a list of OpenAI segment objects) into bounded chunks.
    Chunks are split on segment boundaries to preserve timestamps.
    """
    chunks: List[Dict[str, Any]] = []
    chunk_segments: List[Any] = []
    chunk_units = 0
    chunk_duration = 0.0
    chunk_start: Optional[float] = None

    def push_chunk() -> None:
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
        seg_units = count_words_or_units(seg_text)
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


def _merge_segments_into_sentences(all_segments: List[Any]) -> List[Dict[str, Any]]:
    """
    Merge OpenAI Whisper segments into sentence-like chunks for better readability.
    Returns list of dicts: {start, end, text, segments}
    """
    if not all_segments:
        return []

    merged: List[Dict[str, Any]] = []
    current_text_parts: List[str] = []
    current_segments: List[Any] = []
    carryover_text = ""
    sentence_start: Optional[float] = None

    def flush_sentence() -> None:
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
        early_split_pos = find_early_punctuation_split(text)
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
        late_split_pos = find_late_punctuation_split(text)
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

        if ends_with_sentence(text):
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


def _group_sentences_into_paragraphs(sentences: List[Dict[str, Any]], max_chars: int = 550, gap_seconds: float = 2.0) -> List[Dict[str, Any]]:
    """
    Group sentence chunks into paragraphs based on time gaps and character budget.
    Returns list of dicts: {start, end, text}
    """
    if not sentences:
        return []
    paragraphs: List[Dict[str, Any]] = []
    cur_start = sentences[0]["start"]
    cur_end = sentences[0]["end"]
    cur_parts: List[str] = []

    def push_para() -> None:
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
    sentences: List[Dict[str, Any]],
    *,
    max_chars: int,
    gap_seconds: float,
    max_duration_seconds: float,
) -> List[Dict[str, Any]]:
    """
    Improved paragraph grouping with an additional max-duration bound.
    This avoids giant paragraphs for continuous speech with low gaps.
    """
    if not sentences:
        return []
    paragraphs: List[Dict[str, Any]] = []
    cur_start = float(sentences[0]["start"])
    cur_end = float(sentences[0]["end"])
    cur_parts: List[str] = []

    def push_para() -> None:
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
        # next_end = s_end
        next_duration = s_end - cur_start

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

def _serialize_raw_segments(all_segments: List[Any]) -> List[Dict[str, Any]]:
    """
    Convert OpenAI segment objects into JSON-serializable dicts.
    We intentionally store a minimal, stable shape for future re-formatting:
    {start, end, duration, text}
    """
    raw: List[Dict[str, Any]] = []
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


def format_markdown_from_raw_segments(raw_segments: List[Dict[str, Any]], detected_language: str = "unknown") -> str:
    """
    Public helper: format transcript markdown from stored raw segments (JSON).
    This enables re-formatting without re-transcribing.
    """
    transcript_lines: List[str] = []

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
        start_time = Transcriber.format_time(float(para["start"]))
        transcript_lines.append(f"**[{start_time}]**")
        transcript_lines.append("")
        transcript_lines.append(para["text"])
        transcript_lines.append("")

    return "\n".join(transcript_lines)


class Transcriber:
    """音频转录器，使用 OpenAI API 进行语音转文字"""

    def __init__(self, model_size: Optional[str] = None):
        """
        初始化转录器

        Args:
            model_size: OpenAI 模型名称 (默认使用 config 中的配置)
        """
        self.model_name = model_size or settings.OPENAI_TRANSCRIPTION_MODEL
        self.client: Any = None
        self.last_detected_language: Optional[str] = None

    def _init_client(self) -> None:
        """延迟初始化 OpenAI 客户端 (Async)"""
        if self.client is None:
            # Import new factory
            from utils.openai_client import get_async_openai_client
            self.client = get_async_openai_client()
            if self.client:
                logger.info(f"OpenAI Async Client initialized (Transcriber)")
            else:
                raise ValueError("未找到 OPENAI_API_KEY 环境变量")

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

    async def transcribe_with_raw(self, audio_path: str, language: Optional[str] = None) -> Tuple[str, str, str]:
        """
        Transcribe audio and also return a JSON payload of raw segments for future re-formatting.
        Uses Langfuse span tracking when available.

        Returns:
            (markdown_text, raw_segments_json, detected_language)
        """
        from contextlib import nullcontext, asynccontextmanager
        
        # Langfuse V3: Create a span for Whisper transcription
        # Langfuse async wrapper handles context automatically if we use the wrapped client.
        # But here we want a span. 
        try:
            from langfuse import get_client
            langfuse = get_client()
            # Langfuse's default observation context is synchronous context manager, 
            # but we are in async function. 
            # However, `langfuse.start_as_current_observation` returns a context manager 
            # that handles thread-local state. It usually works fine in async if we don't switch threads wildly.
            # But let's check if we need special handling.
            # The simplest way is to just let the wrapped client handle generation traces.
            # But the user code was manually creating a span "Whisper Transcription".
            
            observation_ctx = (
                langfuse.start_as_current_observation(
                    as_type="generation",
                    name="Whisper Transcription",
                    model=self.model_name,
                    input={"audio_path": audio_path}
                ) if langfuse else nullcontext()
            )
        except ImportError:
            observation_ctx = nullcontext()
        
        # Use simple try-finally since async context manager support in langfuse might vary
        # Actually langfuse observation is a context manager, not async context manager.
        # We can wrap it.
        
        with observation_ctx as gen:
            try:
                # 检查文件是否存在
                if not os.path.exists(audio_path):
                    raise Exception(f"音频文件不存在: {audio_path}")
                
                # 初始化客户端
                self._init_client()
                
                logger.info(f"开始使用 OpenAI (Async) 转录音频: {audio_path}")
            
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

                all_segments = []
                detected_language = "unknown"
            
                try:
                    for chunk_path, offset in files_to_transcribe:
                        logger.info(f"正在转录分片: {chunk_path} (偏移: {offset}s)")
                        
                        # Native Async Call
                        with open(chunk_path, "rb") as audio_file:
                            transcript = await self.client.audio.transcriptions.create(
                                model=self.model_name,
                                file=audio_file,
                                language=language,
                                response_format="verbose_json"
                            )
                    
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
            
                sentences = _merge_segments_into_sentences(all_segments)
                max_chars, max_dur = _paragraph_limits_for_language(detected_language)
                paragraphs = _group_sentences_into_paragraphs_v2(
                    sentences,
                    max_chars=max_chars,
                    gap_seconds=2.0,
                    max_duration_seconds=max_dur,
                )

                for para in paragraphs:
                    start_time = self.format_time(float(para["start"]))
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

    async def _split_audio(self, audio_path: str, chunk_length_ms: int = 10 * 60 * 1000) -> List[Tuple[str, float]]:
        """
        使用 pydub 将音频切分为多个小片段
        """
        from pydub import AudioSegment

        def _do_split() -> List[Tuple[str, float]]:
            try:
                # pydub 依赖 ffmpeg，scripts/start.py 已检查
                audio = AudioSegment.from_file(audio_path)
                duration_ms = len(audio)
                chunks: List[Tuple[str, float]] = []

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

        return await asyncio.to_thread(_do_split)

    @staticmethod
    def format_time(seconds: float) -> str:
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

    def get_supported_languages(self) -> List[str]:
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
        if self.last_detected_language:
            return self.last_detected_language

        if transcript_text and "**Detected Language:**" in transcript_text:
            lines = transcript_text.split('\n')
            for line in lines:
                if "**Detected Language:**" in line:
                    lang = line.split(":")[-1].strip()
                    return lang

        return None
