import os
from stop_words import get_stop_words
import logging
import asyncio
from typing import Optional, Any, List
import json
import re
from pydantic import BaseModel, Field
from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import settings
from utils.openai_client import get_openai_client
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from utils.text_utils import (
    LANGUAGE_MAP,
    get_language_name,
    count_words_or_units,
    ensure_markdown_paragraphs,
    is_cjk_language,
    remove_timestamps_and_meta,
    remove_transcript_heading,
    enforce_paragraph_max_chars,
    extract_pure_text,
    split_into_sentences,
    join_sentences,
    detect_language,
    smart_chunk_text,
)
from prompts import (
    OPTIMIZE_TRANSCRIPT_SYSTEM_ZH,
    OPTIMIZE_TRANSCRIPT_USER_ZH,
    OPTIMIZE_TRANSCRIPT_SYSTEM_EN,
    OPTIMIZE_TRANSCRIPT_USER_EN,
    CHUNK_OPTIMIZE_SYSTEM,
    CHUNK_OPTIMIZE_USER,
    ORGANIZE_PARAGRAPHS_SYSTEM,
    ORGANIZE_PARAGRAPHS_USER,
    ORGANIZE_CHUNK_SYSTEM,
    ORGANIZE_CHUNK_USER,
    SUMMARY_SINGLE_SYSTEM,
    SUMMARY_SINGLE_USER,
    SUMMARY_CHUNK_SYSTEM,
    SUMMARY_CHUNK_USER,
    SUMMARY_INTEGRATE_SYSTEM,
    SUMMARY_INTEGRATE_USER,
    JSON_REPAIR_SYSTEM,
    JSON_REPAIR_USER,
    TRANSLATE_JSON_SYSTEM,
    CONTENT_CLASSIFIER_SYSTEM,
    CONTENT_CLASSIFIER_USER,
    STRUCTURE_TEMPLATES,
    GOAL_TEMPLATES,
    FORM_SUPPLEMENTS,
    SUMMARY_V2_SYSTEM_TEMPLATE,
    SUMMARY_V2_USER_TEMPLATE,
    COMPREHENSION_BRIEF_SYSTEM,
    COMPREHENSION_BRIEF_USER,
)

logger = logging.getLogger(__name__)

# --- Pydantic Models for Structured Output ---


class ContentClassification(BaseModel):
    content_form: str = Field(
        ...,
        description="The form of the content, e.g. casual, tutorial, simple_explanation, deep_dive, interview, monologue, news, review, reaction, finance, narrative, marketing",
    )
    info_structure: str = Field(
        ...,
        description="The structural organization of information, e.g. thematic, sequential, argumentative, comparative, narrative_arc, problem_solution, qa_format, data_driven",
    )
    cognitive_goal: str = Field(
        ...,
        description="The primary cognitive goal for the reader, e.g. understand, decide, execute, inspire, digest, evaluate, solve, memorize",
    )
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")


class KeyPoint(BaseModel):
    title: str = Field(..., description="Concise title of the key point")
    detail: str = Field(..., description="Detailed explanation of the key point")
    evidence: str = Field(
        ..., description="Exact quote or evidence from the text properly attributed"
    )


class ActionItem(BaseModel):
    content: str = Field(..., description="The action item or next step")
    priority: str = Field(
        default="medium", description="Priority level: high, medium, or low"
    )


class Risk(BaseModel):
    content: str = Field(..., description="The risk or warning description")
    severity: str = Field(
        default="medium", description="Severity level: high, medium, or low"
    )


class SummaryResponse(BaseModel):
    version: int = Field(default=2)
    language: str = Field(..., description="Language code of the summary (e.g., 'zh')")
    overview: str = Field(..., description="A comprehensive overview of the content")
    keypoints: List[KeyPoint] = Field(
        ..., description="List of key points extracted from the content"
    )
    action_items: Optional[List[ActionItem]] = Field(
        default_factory=list, description="List of actionable next steps"
    )
    risks: Optional[List[Risk]] = Field(
        default_factory=list, description="List of risks or warnings mentioned"
    )
    content_type: Optional[ContentClassification] = Field(
        None, description="Classification metadata if available"
    )


class Summarizer:
    """文本总结器，使用LangChain ChatOpenAI生成多语言摘要"""

    @staticmethod
    def _read_int_env(
        name: str,
        default: int,
        *,
        min_value: int | None = None,
        max_value: int | None = None,
    ) -> int:
        raw = os.getenv(name)
        if raw is None or str(raw).strip() == "":
            val = int(default)
        else:
            try:
                val = int(str(raw).strip())
            except Exception:
                logger.warning(
                    f"Invalid int env {name}={raw!r}, using default={default}"
                )
                val = int(default)
        if min_value is not None:
            val = max(min_value, val)
        if max_value is not None:
            val = min(max_value, val)
        return val

    @staticmethod
    def _read_bool_env(name: str, default: bool) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return bool(default)
        s = str(raw).strip().lower()
        if s in ("1", "true", "t", "yes", "y", "on"):
            return True
        if s in ("0", "false", "f", "no", "n", "off"):
            return False
        return bool(default)

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.base_url = os.getenv("OPENAI_BASE_URL")

        if self.api_key:
            logger.info("Summarizer initialized with OpenAI capabilities (LangChain)")
        else:
            logger.warning(
                "OPENAI_API_KEY missing, Summarizer will not function correctly"
            )

        explicit_summary_model = (os.getenv("OPENAI_SUMMARY_MODEL") or "").strip()
        explicit_fallback_model = (
            os.getenv("OPENAI_SUMMARY_FALLBACK_MODEL") or ""
        ).strip()

        if explicit_summary_model:
            default_summary_chain = [
                explicit_summary_model,
                explicit_fallback_model,
            ] + settings.OPENAI_SUMMARY_MODELS
            default_summary_chain = [m for m in default_summary_chain if m]
        else:
            default_summary_chain = list(settings.OPENAI_SUMMARY_MODELS)
            if explicit_fallback_model:
                default_summary_chain.insert(1, explicit_fallback_model)

        self.summary_models = self._dedupe_models(default_summary_chain)
        self.transcript_model = (
            os.getenv("OPENAI_TRANSCRIPT_MODEL") or settings.OPENAI_HELPER_MODEL
        )
        self.paragraph_model = (
            os.getenv("OPENAI_PARAGRAPH_MODEL") or settings.OPENAI_HELPER_MODEL
        )

        self.summary_single_max_est_tokens = self._read_int_env(
            "OPENAI_SUMMARY_SINGLE_MAX_EST_TOKENS",
            16000,
            min_value=3000,
            max_value=120000,
        )
        self.summary_chunk_max_chars = self._read_int_env(
            "OPENAI_SUMMARY_CHUNK_MAX_CHARS", 9000, min_value=2000, max_value=30000
        )
        self.summary_single_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_SINGLE_MAX_OUTPUT_TOKENS",
            8192,
            min_value=800,
            max_value=16384,
        )
        self.summary_chunk_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_CHUNK_MAX_OUTPUT_TOKENS",
            1800,
            min_value=500,
            max_value=6000,
        )
        self.summary_integrate_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_INTEGRATE_MAX_OUTPUT_TOKENS",
            2800,
            min_value=800,
            max_value=8000,
        )
        self.summary_max_keypoints_per_chunk = self._read_int_env(
            "OPENAI_SUMMARY_MAX_KEYPOINTS_PER_CHUNK", 10, min_value=1, max_value=24
        )
        self.summary_max_keypoints_final = self._read_int_env(
            "OPENAI_SUMMARY_MAX_KEYPOINTS_FINAL", 24, min_value=6, max_value=48
        )
        self.summary_max_keypoints_candidates = self._read_int_env(
            "OPENAI_SUMMARY_MAX_KEYPOINTS_CANDIDATES", 140, min_value=24, max_value=2000
        )
        self.enable_json_repair = self._read_bool_env(
            "OPENAI_SUMMARY_JSON_REPAIR", True
        )
        self.json_repair_model = (
            os.getenv("OPENAI_JSON_REPAIR_MODEL") or ""
        ).strip() or settings.OPENAI_HELPER_MODEL
        self.classifier_model = (
            os.getenv("OPENAI_CLASSIFIER_MODEL") or ""
        ).strip() or "gpt-5-mini"
        self.use_response_format_json = self._read_bool_env(
            "OPENAI_USE_RESPONSE_FORMAT_JSON", True
        )
        self.summary_match_threshold = float(
            os.getenv("OPENAI_SUMMARY_MATCH_THRESHOLD", "4.0")
        )
        self.language_map = LANGUAGE_MAP

    @staticmethod
    def _dedupe_models(models: list[str]) -> list[str]:
        out = []
        seen = set()
        for m in models:
            m = (m or "").strip()
            if m and m not in seen:
                out.append(m)
                seen.add(m)
        return out

    def _get_llm(self, model: str, max_tokens: int = None, model_kwargs: dict = None):
        return ChatOpenAI(
            model=model,
            api_key=self.api_key,
            base_url=self.base_url,
            max_tokens=max_tokens,
            model_kwargs=model_kwargs or {},
            temperature=0.1,
        )

    async def _ainvoke_with_fallback(
        self,
        models: list[str],
        messages: list[dict],
        trace_config: dict = None,
        **kwargs,
    ):
        lc_messages = []
        for m in messages:
            if m["role"] == "system":
                lc_messages.append(SystemMessage(content=m["content"]))
            elif m["role"] == "user":
                lc_messages.append(HumanMessage(content=m["content"]))
            else:
                lc_messages.append(HumanMessage(content=m["content"]))

        trace_config = trace_config or {}
        lc_config = {
            "run_name": trace_config.get("name", "LLM Call"),
            "metadata": trace_config.get("metadata", {}),
            **{k: v for k, v in trace_config.items() if k not in ("name", "metadata")},
        }

        model_kwargs = kwargs.get("model_kwargs", {}) or {}
        if "response_format" in kwargs:
            model_kwargs["response_format"] = kwargs.pop("response_format")

        max_tokens = kwargs.get("max_completion_tokens")

        last_exception = None
        for model in models:
            try:
                llm = self._get_llm(
                    model, max_tokens=max_tokens, model_kwargs=model_kwargs
                )
                response = await llm.ainvoke(lc_messages, config=lc_config)
                return response
            except Exception as e:
                logger.warning(f"Model {model} failed: {e}")
                last_exception = e
                continue

        raise last_exception or Exception("All models failed")

    async def optimize_transcript(
        self, raw_transcript: str, trace_metadata: dict = None
    ) -> str:
        trace_metadata = trace_metadata or {}
        trace_config = {
            "name": "Transcript Optimization",
            "metadata": {
                **trace_metadata.get("metadata", {}),
                "text_len": len(raw_transcript),
            },
            **{k: v for k, v in trace_metadata.items() if k != "metadata"},
        }

        try:
            if not self.api_key:
                logger.warning("OpenAI API unavailable, returning improved transcript")
                return remove_timestamps_and_meta(raw_transcript)

            preprocessed = remove_timestamps_and_meta(raw_transcript)
            detected_lang_code = detect_language(preprocessed)
            max_chars_per_chunk = 12000

            if len(preprocessed) > max_chars_per_chunk:
                logger.info(f"Text long ({len(preprocessed)}), chunking optimization")
                trace_config["metadata"]["strategy"] = "chunked"
                return await self._format_long_transcript_in_chunks(
                    preprocessed, detected_lang_code, max_chars_per_chunk, trace_config
                )
            else:
                trace_config["metadata"]["strategy"] = "single"
                return await self._format_single_chunk(
                    preprocessed, detected_lang_code, trace_config=trace_config
                )
        except Exception as e:
            logger.error(f"Transcript optimization failed: {e}")
            return raw_transcript

    def fast_clean_transcript(self, raw_transcript: str) -> str:
        if not raw_transcript:
            return ""
        cleaned = remove_timestamps_and_meta(raw_transcript)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    # ---------------------------------------------------------------------
    def _estimate_tokens(self, text: str) -> int:
        chinese_chars = sum(1 for char in text if "\u4e00" <= char <= "\u9fff")
        english_words = len(
            [word for word in text.split() if word.isascii() and word.isalpha()]
        )
        base_tokens = chinese_chars * 1.5 + english_words * 1.3
        format_overhead = len(text) * 0.15
        system_prompt_overhead = self._read_int_env(
            "OPENAI_TOKEN_ESTIMATE_OVERHEAD", 2500, min_value=0, max_value=20000
        )
        return int(base_tokens + format_overhead + system_prompt_overhead)

    def _extract_first_json_object(self, text: str) -> Optional[str]:
        if not text:
            return None
        s = text.strip()
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
        start = s.find("{")
        end = s.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return s[start : end + 1]

    def _fallback_summary_json_v1(self, transcript: str, target_language: str) -> str:
        cleaned = remove_timestamps_and_meta(transcript or "").strip()
        overview = cleaned[:900].strip() + ("…" if len(cleaned) > 900 else "")
        keypoints = []
        parts = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
        for p in parts[:8]:
            snippet = p[:260].strip()
            if len(p) > 260:
                snippet += "…"
            keypoints.append(
                {
                    "title": snippet[:48] + ("…" if len(snippet) > 48 else ""),
                    "detail": snippet,
                    "evidence": "",
                }
            )
        return json.dumps(
            {
                "version": 2,
                "language": target_language,
                "overview": overview,
                "keypoints": keypoints,
            },
            ensure_ascii=False,
        )

    async def _format_single_chunk(
        self,
        chunk_text: str,
        transcript_language: str = "zh",
        trace_config: dict = None,
    ) -> str:
        if transcript_language == "zh":
            system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_ZH
            prompt = OPTIMIZE_TRANSCRIPT_USER_ZH.format(text=chunk_text)
        else:
            system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_EN
            prompt = OPTIMIZE_TRANSCRIPT_USER_EN.format(text=chunk_text)

        try:
            response = await self._ainvoke_with_fallback(
                models=[self.transcript_model],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                max_completion_tokens=14000,
                trace_config=trace_config,
            )
            optimized_text = response.content or ""
            optimized_text = remove_transcript_heading(optimized_text)
            enforced = enforce_paragraph_max_chars(
                optimized_text.strip(), max_chars=400
            )
            return ensure_markdown_paragraphs(enforced)
        except Exception as e:
            logger.error(f"Chunk optimization failed: {e}")
            return self._apply_basic_formatting(chunk_text)

    def _smart_split_long_chunk(self, text: str, max_chars_per_chunk: int) -> list:
        # Replaced custom logic with LangChain RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "。", "！", "？", ".", "!", "?", "，", "；", ", ", " "],
            chunk_size=max_chars_per_chunk,
            chunk_overlap=int(max_chars_per_chunk * 0.05),
            length_function=len,
            is_separator_regex=False,
        )
        return splitter.split_text(text)

    def _find_safe_cut_point(self, text: str) -> int:
        # Kept for compatibility if used elsewhere, or could overlap with splitter logic
        # But for now let's keep it simple or minimal.
        # Actually used by _find_overlap_between_texts.
        p = text.rfind("\n\n")
        if p > 0:
            return p + 2
        last_sentence_end = -1
        for m in re.finditer(r"[。！？\.!?]\s*", text):
            last_sentence_end = m.end()
        if last_sentence_end > 20:
            return last_sentence_end
        return len(text)

    def _find_overlap_between_texts(self, text1: str, text2: str) -> str:
        max_len = min(len(text1), len(text2))
        for length in range(max_len, 19, -1):
            if text1[-length:] == text2[:length]:
                cut = self._find_safe_cut_point(text2[:length])
                if cut > 20:
                    return text2[:cut]
                return text1[-length:]
        return ""

    def _apply_basic_formatting(self, text: str) -> str:
        if not text or not text.strip():
            return text
        parts = re.split(r"([。！？\.!?]+\s*)", text)
        sentences = []
        cur = ""
        for i, part in enumerate(parts):
            cur += part
            if i % 2 != 0:
                if cur.strip():
                    sentences.append(cur.strip())
                cur = ""
        if cur.strip():
            sentences.append(cur.strip())

        paras = []
        cur = ""
        sentence_count = 0
        for s in sentences:
            candidate = (cur + " " + s).strip() if cur else s
            sentence_count += 1
            should_break = False
            if len(candidate) > 400 and cur:
                should_break = True
            elif len(candidate) > 200 and sentence_count >= 3:
                should_break = True
            elif sentence_count >= 6:
                should_break = True

            if should_break:
                paras.append(cur.strip())
                cur = s
                sentence_count = 1
            else:
                cur = candidate
        if cur.strip():
            paras.append(cur.strip())
        return ensure_markdown_paragraphs("\n\n".join(paras))

    async def _format_long_transcript_in_chunks(
        self,
        raw_transcript: str,
        transcript_language: str,
        max_chars_per_chunk: int,
        trace_config: dict = None,
    ) -> str:
        parts = re.split(r"([。！？\.!?]+\s*)", raw_transcript)
        sentences = []
        buf = ""
        for i, part in enumerate(parts):
            buf += part
            if i % 2 != 0:
                if buf.strip():
                    sentences.append(buf.strip())
                buf = ""
        if buf.strip():
            sentences.append(buf.strip())

        chunks = []
        cur = ""
        for s in sentences:
            candidate = (cur + " " + s).strip() if cur else s
            if len(candidate) > max_chars_per_chunk and cur:
                chunks.append(cur.strip())
                cur = s
            else:
                cur = candidate
        if cur.strip():
            chunks.append(cur.strip())

        final_chunks = []
        for c in chunks:
            if len(c) <= max_chars_per_chunk:
                final_chunks.append(c)
            else:
                final_chunks.extend(
                    self._smart_split_long_chunk(c, max_chars_per_chunk)
                )

        logger.info(f"Splitting into {len(final_chunks)} chunks for optimization")
        optimized = []
        for i, c in enumerate(final_chunks):
            chunk_with_context = c
            if i > 0:
                prev_tail = final_chunks[i - 1][-100:]
                marker = (
                    f"[上文续：{prev_tail}]"
                    if transcript_language == "zh"
                    else f"[Context continued: {prev_tail}]"
                )
                chunk_with_context = marker + "\n\n" + c
            try:
                chunk_config = None
                if trace_config:
                    chunk_config = trace_config.copy()
                    chunk_config["metadata"] = {
                        **chunk_config.get("metadata", {}),
                        "chunk_index": i,
                    }

                oc = await self._format_single_chunk(
                    chunk_with_context, transcript_language, trace_config=chunk_config
                )
                oc = re.sub(
                    r"^\[(上文续|Context continued)：?:?.*?\]\s*", "", oc, flags=re.S
                )
                optimized.append(oc)
            except Exception as e:
                logger.warning(f"Chunk {i + 1} failed optimization: {e}")
                optimized.append(self._apply_basic_formatting(c))

        deduped = []
        for i, c in enumerate(optimized):
            cur_txt = c
            if i > 0 and deduped:
                prev = deduped[-1]
                overlap = self._find_overlap_between_texts(prev[-200:], cur_txt[:200])
                if overlap:
                    cur_txt = cur_txt[len(overlap) :].lstrip()
            if cur_txt.strip():
                deduped.append(cur_txt)

        merged = "\n\n".join(deduped)
        merged = remove_transcript_heading(merged)
        enforced = enforce_paragraph_max_chars(merged, max_chars=400)
        return ensure_markdown_paragraphs(enforced)

    def _split_into_chunks(self, text: str, max_tokens: int) -> list:
        # Replaced custom token-estimation based splitting with LangChain Splitter
        # Note: We use length_function=self._estimate_tokens to respect token limits
        pure_text = extract_pure_text(text)

        splitter = RecursiveCharacterTextSplitter(
            separators=["\n\n", "\n", "。", "！", "？", ".", "!", "?", " "],
            chunk_size=max_tokens,
            chunk_overlap=int(max_tokens * 0.05),
            length_function=self._estimate_tokens,
            is_separator_regex=False,
        )
        return splitter.split_text(pure_text)

    async def _final_paragraph_organization(
        self, text: str, lang_instruction: str
    ) -> str:
        try:
            estimated_tokens = self._estimate_tokens(text)
            if estimated_tokens > 3000:
                return await self._organize_long_text_paragraphs(text, lang_instruction)

            system_prompt = ORGANIZE_PARAGRAPHS_SYSTEM.format(
                lang_instruction=lang_instruction
            )
            user_prompt = ORGANIZE_PARAGRAPHS_USER.format(
                lang_instruction=lang_instruction, text=text
            )

            response = await self._ainvoke_with_fallback(
                models=[self.paragraph_model],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=4000,
            )
            return self._validate_paragraph_lengths(response.content)
        except Exception as e:
            logger.error(f"Final paragraph organization failed: {e}")
            return self._basic_paragraph_fallback(text)

    async def _organize_long_text_paragraphs(
        self, text: str, lang_instruction: str
    ) -> str:
        try:
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            organized_chunks = []
            current_chunk = []
            current_tokens = 0
            max_chunk_tokens = 2500

            for para in paragraphs:
                para_tokens = self._estimate_tokens(para)
                if current_tokens + para_tokens > max_chunk_tokens and current_chunk:
                    chunk_text = "\n\n".join(current_chunk)
                    organized_chunks.append(
                        await self._organize_single_chunk(chunk_text, lang_instruction)
                    )
                    current_chunk = [para]
                    current_tokens = para_tokens
                else:
                    current_chunk.append(para)
                    current_tokens += para_tokens
            if current_chunk:
                chunk_text = "\n\n".join(current_chunk)
                organized_chunks.append(
                    await self._organize_single_chunk(chunk_text, lang_instruction)
                )

            return "\n\n".join(organized_chunks)
        except Exception as e:
            logger.error(f"Long text organization failed: {e}")
            return self._basic_paragraph_fallback(text)

    async def _organize_single_chunk(self, text: str, lang_instruction: str) -> str:
        system_prompt = ORGANIZE_CHUNK_SYSTEM.format(lang_instruction=lang_instruction)
        user_prompt = ORGANIZE_CHUNK_USER.format(
            lang_instruction=lang_instruction, text=text
        )
        response = await self._ainvoke_with_fallback(
            models=[self.paragraph_model],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=1200,
        )
        return response.content

    def _validate_paragraph_lengths(self, text: str) -> str:
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        validated = []
        for para in paragraphs:
            if len(para.split()) > 300:
                validated.extend(self._split_long_paragraph(para))
            else:
                validated.append(para)
        return "\n\n".join(validated)

    def _split_long_paragraph(self, paragraph: str) -> list:
        parts = re.split(r"([.!?。！？]\s+)", paragraph)
        sentences = []
        for i in range(0, len(parts) - 1, 2):
            sentences.append(parts[i] + parts[i + 1])
        if len(parts) % 2 != 0 and parts[-1].strip():
            sentences.append(parts[-1])

        split = []
        cur_para = []
        cur_len = 0
        for s in sentences:
            slen = len(s.split())
            if cur_len + slen > 200 and cur_para:
                split.append(" ".join(cur_para))
                cur_para = [s]
                cur_len = slen
            else:
                cur_para.append(s)
                cur_len += slen
        if cur_para:
            split.append(" ".join(cur_para))
        return split

    def _basic_paragraph_fallback(self, text: str) -> str:
        text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        basic = []
        for para in paragraphs:
            wc = len(para.split())
            if wc > 250:
                basic.extend(self._split_long_paragraph(para))
            elif wc < 30 and basic:
                last = basic[-1]
                if len(last.split()) + wc <= 200:
                    basic[-1] = last + " " + para
                else:
                    basic.append(para)
            else:
                basic.append(para)
        return "\n\n".join(basic)

    async def summarize(
        self,
        transcript: str,
        target_language: str = "zh",
        video_title: str = None,
        existing_classification: dict | None = None,
        trace_metadata: dict = None,
    ) -> str:
        try:
            if not self.api_key:
                logger.warning("OpenAI API unavailable, fallback JSON summary")
                return self._fallback_summary_json_v1(transcript, target_language)

            target_language = self._normalize_lang_code(target_language)

            if settings.SUMMARY_STRATEGY == "v2_classified":
                logger.info("Using V2 classified summary strategy")
                return await self._summarize_v2_classified(
                    transcript,
                    target_language,
                    existing_classification=existing_classification,
                    trace_metadata=trace_metadata,
                )

            estimated_tokens = self._estimate_tokens(transcript)
            max_summarize_tokens = int(self.summary_single_max_est_tokens)

            if estimated_tokens <= max_summarize_tokens:
                return await self._summarize_single_text_json(
                    transcript, target_language, trace_metadata=trace_metadata
                )
            else:
                logger.info(
                    f"Text long ({estimated_tokens} tokens), using chunked summary"
                )
                return await self._summarize_with_chunks_json(
                    transcript,
                    target_language,
                    max_summarize_tokens,
                    trace_metadata=trace_metadata,
                )

        except Exception as e:
            logger.error(f"Summary generation failed: {str(e)}")
            return self._fallback_summary_json_v1(transcript, target_language)

    async def classify_content(
        self, transcript: str, trace_metadata: dict = None
    ) -> dict:
        transcript_sample = transcript[
            :15000
        ]  # Increased limit since we trust structural output
        system_prompt = CONTENT_CLASSIFIER_SYSTEM
        user_prompt = CONTENT_CLASSIFIER_USER.format(
            transcript_sample=transcript_sample
        )

        try:
            trace_config = None
            if trace_metadata:
                trace_config = {
                    "name": "Content Classification",
                    "metadata": {**trace_metadata.get("metadata", {})},
                    **{k: v for k, v in trace_metadata.items() if k != "metadata"},
                }

            # Use with_structured_output for robust JSON parsing
            llm = self._get_llm(self.classifier_model, max_tokens=500)
            structured_llm = llm.with_structured_output(ContentClassification)

            # Note: _ainvoke_with_fallback handles raw messages, but here we use the specific structured invoke
            # We bypass _ainvoke_with_fallback for now to use the structured method directly,
            # or we could adapt _ainvoke_with_fallback to support structured output.
            # For simplicity in this refactor, let's call structured_llm directly or use a simple fallback loop.

            # Since _ainvoke_with_fallback is custom, let's try to adapt logic inline for structured output
            # But the simplest way is to just call ainvoke on the structured_llm

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            # Add tracing config to the call
            # LangChain's ainvoke accepts 'config'
            lc_config = {
                "run_name": trace_config.get("name", "Content Classification")
                if trace_config
                else "Content Classification",
                "metadata": trace_config.get("metadata", {}) if trace_config else {},
            }

            classification: ContentClassification = await structured_llm.ainvoke(
                messages, config=lc_config
            )

            # Convert back to dict for compatibility
            result = {
                "content_form": classification.content_form,
                "info_structure": classification.info_structure,
                "cognitive_goal": classification.cognitive_goal,
                "confidence": classification.confidence,
            }

            # Normalize defaults (Fallback validation is technically handled by Pydantic but we ensure safe strings)
            valid_forms = {
                "tutorial",
                "interview",
                "monologue",
                "news",
                "review",
                "finance",
                "narrative",
                "casual",
            }
            valid_structures = {
                "hierarchical",
                "sequential",
                "argumentative",
                "comparative",
                "narrative_arc",
                "thematic",
                "qa_format",
                "data_driven",
            }
            valid_goals = {"understand", "decide", "execute", "inspire", "digest"}

            if result["content_form"] not in valid_forms:
                result["content_form"] = "casual"
            if result["info_structure"] not in valid_structures:
                result["info_structure"] = "thematic"
            if result["cognitive_goal"] not in valid_goals:
                result["cognitive_goal"] = "digest"

            logger.info(f"Classification result (Structured): {result}")
            return result

        except Exception as e:
            logger.warning(f"Classification failed, using defaults: {e}")
            return {
                "content_form": "casual",
                "info_structure": "thematic",
                "cognitive_goal": "digest",
                "confidence": 0.0,
            }

    def _build_v2_dynamic_prompt(
        self, classification: dict, language_name: str, target_language: str
    ) -> tuple[str, str]:
        content_form = classification.get("content_form", "casual")
        info_structure = classification.get("info_structure", "thematic")
        cognitive_goal = classification.get("cognitive_goal", "digest")

        structure_instruction = STRUCTURE_TEMPLATES.get(
            info_structure, STRUCTURE_TEMPLATES["thematic"]
        )
        goal_instruction = GOAL_TEMPLATES.get(cognitive_goal, GOAL_TEMPLATES["digest"])
        form_supplement = FORM_SUPPLEMENTS.get(content_form, FORM_SUPPLEMENTS["casual"])

        system_prompt = SUMMARY_V2_SYSTEM_TEMPLATE.format(
            language_name=language_name,
            target_language=target_language,
            structure_instruction=structure_instruction,
            goal_instruction=goal_instruction,
            form_supplement=form_supplement,
            content_form=content_form,
            info_structure=info_structure,
            cognitive_goal=cognitive_goal,
        )
        return system_prompt

    async def _summarize_v2_classified(
        self,
        transcript: str,
        target_language: str,
        existing_classification: dict | None = None,
        trace_metadata: dict = None,
    ) -> str:
        language_name = self.language_map.get(target_language, "English")
        if existing_classification:
            classification = existing_classification
            logger.info(f"Using existing classification: {classification}")
        else:
            classification = await self.classify_content(
                transcript, trace_metadata=trace_metadata
            )

        system_prompt = self._build_v2_dynamic_prompt(
            classification, language_name, target_language
        )
        content_type_info = f"Form: {classification.get('content_form')}, Structure: {classification.get('info_structure')}, Goal: {classification.get('cognitive_goal')}"
        user_prompt = SUMMARY_V2_USER_TEMPLATE.format(
            language_name=language_name,
            transcript=transcript,
            content_type_info=content_type_info,
        )

        trace_config = None
        if trace_metadata:
            trace_config = {
                "name": "Summary Generation (V2)",
                "metadata": {
                    **trace_metadata.get("metadata", {}),
                    "content_form": classification.get("content_form"),
                    "language": target_language,
                },
                **{k: v for k, v in trace_metadata.items() if k != "metadata"},
            }

        try:
            # Implement fallback loop for structured output
            last_exception = None
            for model in self.summary_models:
                try:
                    llm = self._get_llm(
                        model, max_tokens=self.summary_single_max_output_tokens
                    )
                    structured_llm = llm.with_structured_output(SummaryResponse)

                    messages = [
                        SystemMessage(content=system_prompt),
                        HumanMessage(content=user_prompt),
                    ]

                    lc_config = {
                        "run_name": trace_config.get("name", "Summary Generation (V2)")
                        if trace_config
                        else None,
                        "metadata": trace_config.get("metadata", {})
                        if trace_config
                        else {},
                        **{
                            k: v
                            for k, v in (trace_config or {}).items()
                            if k not in ["name", "metadata"]
                        },
                    }

                    summary_obj: SummaryResponse = await structured_llm.ainvoke(
                        messages, config=lc_config
                    )

                    # Convert to dict
                    obj = summary_obj.dict()
                    if "content_type" in obj:
                        obj["content_type"] = classification

                    return json.dumps(obj, ensure_ascii=False)
                except Exception as e:
                    last_exception = e
                    logger.warning(f"Summarize V2 with model {model} failed: {e}")
                    continue

            raise last_exception or Exception("All models failed for Summarize V2")
        except Exception as e:
            logger.error(f"Summarize V2 failed: {e}")
            # Try repair on whatever raw we had? (Not applicable here as we failed LLM call or parsing)
            # Fallback to legacy
            pass
            return self._fallback_summary_json_v1(transcript, target_language)

    def _normalize_lang_code(self, lang: Optional[str]) -> str:
        if not lang:
            return "unknown"
        s = str(lang).strip().lower()
        name_map = {
            "chinese": "zh",
            "japanese": "ja",
            "korean": "ko",
            "english": "en",
            "french": "fr",
            "german": "de",
            "italian": "it",
            "spanish": "es",
            "portuguese": "pt",
            "russian": "ru",
        }
        if s in name_map:
            return name_map[s]
        s = s.replace("_", "-")
        if not s:
            return "unknown"
        if s.startswith("zh-"):
            return "zh"
        return s.split("-")[0] or "unknown"

    def _parse_script_raw_payload(
        self, script_raw_json: Optional[str]
    ) -> tuple[str, list[dict]]:
        if not script_raw_json:
            return "unknown", []
        try:
            payload = json.loads(script_raw_json)
        except:
            return "unknown", []
        if not isinstance(payload, dict):
            return "unknown", []
        lang = self._normalize_lang_code(payload.get("language"))
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
            except:
                continue
        return lang, out

    @staticmethod
    def _build_keypoint_query(kp: dict) -> str:
        if not isinstance(kp, dict):
            return ""
        evidence = str(kp.get("evidence", "")).strip()
        title = str(kp.get("title", "")).strip()

        # If evidence exists (and is reasonably long), use it exclusively or with title
        # to ensure we match the specific quote rather than the generic summary detail.
        if len(evidence) > 5:
            return f"{evidence} {title}".strip()

        # Fallback: if no evidence, use title + trimmed detail
        detail = str(kp.get("detail", "")).strip()[
            :100
        ]  # Reduced from 220 to reduce noise
        return f"{title} {detail}".strip()

    @staticmethod
    def _is_cjk_text(text: str) -> bool:
        if not text:
            return False
        return any("\u4e00" <= ch <= "\u9fff" for ch in text)

    @staticmethod
    def _normalize_for_match(text: str) -> str:
        s = (text or "").lower()
        s = re.sub(r"[^\w\u4e00-\u9fff]+", " ", s, flags=re.UNICODE)
        return re.sub(r"\s+", " ", s).strip()

    def _tokenize_for_match(self, text: str, lang: str = "en") -> set[str]:
        s = self._normalize_for_match(text)
        if not s:
            return set()
        if self._is_cjk_text(s):
            compact = s.replace(" ", "")
            if len(compact) <= 1:
                return {compact} if compact else set()
            return {compact[i : i + 2] for i in range(len(compact) - 1)}

        # Dynamic English/Foreign stop words
        try:
            # stop-words library uses 2-letter codes mostly
            target = lang.lower() if lang else "en"
            if target == "unknown":
                target = "en"
            stop_words = set(get_stop_words(target))
        except:
            # Fallback to English if language not supported or error
            stop_words = {
                "the",
                "be",
                "to",
                "of",
                "and",
                "a",
                "in",
                "that",
                "have",
                "i",
                "it",
                "for",
                "not",
                "on",
                "with",
                "he",
                "as",
                "you",
                "do",
                "at",
                "this",
                "but",
                "his",
                "by",
                "from",
                "they",
                "we",
                "say",
                "her",
                "she",
                "or",
                "an",
                "will",
                "my",
                "one",
                "all",
                "would",
                "there",
                "their",
                "what",
                "so",
                "up",
                "out",
                "if",
                "about",
                "who",
                "get",
                "which",
                "go",
                "me",
                "when",
                "make",
                "can",
                "like",
                "time",
                "no",
                "just",
                "him",
                "know",
                "take",
                "people",
                "into",
                "year",
                "your",
                "good",
                "some",
                "could",
                "them",
                "see",
                "other",
                "than",
                "then",
                "now",
                "look",
                "only",
                "come",
                "its",
                "over",
                "think",
                "also",
                "back",
                "after",
                "use",
                "two",
                "how",
                "our",
                "work",
                "first",
                "well",
                "way",
                "even",
                "new",
                "want",
                "because",
                "any",
                "these",
                "give",
                "day",
                "most",
                "us",
                "is",
                "are",
                "was",
                "were",
                "has",
                "had",
            }

        return {t for t in s.split(" ") if len(t) >= 2 and t not in stop_words}

    def _score_segment_match(
        self, *, query: str, query_tokens: set[str], seg_text: str, seg_tokens: set[str]
    ) -> float:
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

    def _inject_keypoint_timestamps(
        self, summary_obj: dict, segments: list[dict], lang: str = "en"
    ) -> dict:
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

            if best_idx == -1 or best_score < self.summary_match_threshold:
                continue

            start_idx, end_idx = best_idx, best_idx
            expansion_ratio = 0.6
            min_expansion_score = self.summary_match_threshold * 0.8

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
                    segments[end_idx].get("end", kp["startSeconds"])
                )
            except:
                continue

        try:
            summary_obj["version"] = max(int(summary_obj.get("version", 1) or 1), 2)
        except:
            summary_obj["version"] = 2
        return summary_obj

    async def summarize_in_language_with_anchors(
        self,
        transcript: str,
        *,
        summary_language: str,
        video_title: str | None = None,
        script_raw_json: str | None = None,
        existing_classification: dict | None = None,
        trace_metadata: dict = None,
    ) -> str:
        base = await self.summarize(
            transcript,
            summary_language,
            video_title,
            existing_classification=existing_classification,
            trace_metadata=trace_metadata,
        )
        raw_info_lang, segments = self._parse_script_raw_payload(script_raw_json)
        if not segments:
            return base
        try:
            obj = json.loads(base)
            if isinstance(obj, dict):
                lang_code = (
                    self._normalize_lang_code(raw_info_lang).split("-")[0]
                    if raw_info_lang != "unknown"
                    else "en"
                )
                obj = self._inject_keypoint_timestamps(obj, segments, lang=lang_code)
                return json.dumps(obj, ensure_ascii=False)
            return base
        except:
            return base

    def _validate_summary_json_v1(self, obj: dict, target_language: str) -> dict:
        if not isinstance(obj, dict):
            raise ValueError("Summary JSON must be an object")
        version = int(obj.get("version", 2))
        language = str(obj.get("language", target_language))
        overview = str(obj.get("overview", "") or "").strip()
        keypoints = obj.get("keypoints", [])
        normalized_kps = []
        if isinstance(keypoints, list):
            for kp in keypoints:
                if not isinstance(kp, dict):
                    continue
                title = str(kp.get("title") or "").strip()
                detail = str(kp.get("detail") or "").strip()
                if not title and not detail:
                    continue
                out = {
                    "title": title or detail[:48],
                    "detail": detail,
                    "evidence": str(kp.get("evidence") or "").strip(),
                }
                if "startSeconds" in kp:
                    out["startSeconds"] = float(kp["startSeconds"])
                if "endSeconds" in kp:
                    out["endSeconds"] = float(kp["endSeconds"])
                normalized_kps.append(out)
        return {
            "version": version,
            "language": language,
            "overview": overview,
            "keypoints": normalized_kps,
        }

    async def translate_summary_json(
        self, summary_json: str, *, target_language: str, trace_metadata: dict = None
    ) -> str:
        if not summary_json:
            return summary_json
        try:
            src_obj = json.loads(summary_json)
        except:
            return summary_json
        if not isinstance(src_obj, dict):
            return summary_json
        src_obj = self._validate_summary_json_v1(
            src_obj, str(src_obj.get("language") or "unknown")
        )
        if not self.api_key:
            return json.dumps(src_obj, ensure_ascii=False)

        tgt = self._normalize_lang_code(target_language)
        language_name = self.language_map.get(tgt, tgt)
        system_prompt = TRANSLATE_JSON_SYSTEM.format(
            language_name=language_name, target_language=tgt
        )
        user_prompt = json.dumps(
            {"targetLanguage": tgt, "input": src_obj}, ensure_ascii=False
        )

        trace_config = None
        if trace_metadata:
            trace_config = {
                "name": "Translate Summary",
                "metadata": {
                    **trace_metadata.get("metadata", {}),
                    "target_language": target_language,
                },
                **{k: v for k, v in trace_metadata.items() if k != "metadata"},
            }

        try:
            response = await self._ainvoke_with_fallback(
                models=self.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=max(
                    1200, int(self.summary_integrate_max_output_tokens)
                ),
                trace_config=trace_config,
                response_format={"type": "json_object"}
                if self.use_response_format_json
                else None,
            )
            raw = (response.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            out = json.loads(json_text)
            out = self._validate_summary_json_v1(out, tgt)
            out["language"] = tgt
            return json.dumps(out, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Translation failed: {e}")
            return json.dumps(src_obj, ensure_ascii=False)

    async def _summarize_single_text_json(
        self, transcript: str, target_language: str, trace_metadata: dict = None
    ) -> str:
        language_name = self.language_map.get(target_language, "English")
        system_prompt = SUMMARY_SINGLE_SYSTEM.format(
            language_name=language_name, target_language=target_language
        )
        user_prompt = SUMMARY_SINGLE_USER.format(
            language_name=language_name, transcript=transcript
        )

        trace_config = None
        if trace_metadata:
            trace_config = {
                "name": "Summary Generation (Single)",
                "metadata": {
                    **trace_metadata.get("metadata", {}),
                    "target_language": target_language,
                },
                **{k: v for k, v in trace_metadata.items() if k != "metadata"},
            }

        try:
            response = await self._ainvoke_with_fallback(
                models=self.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=int(self.summary_single_max_output_tokens),
                trace_config=trace_config,
                response_format={"type": "json_object"}
                if self.use_response_format_json
                else None,
            )
            raw = (response.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Summary JSON failed: {e}")
            if self.enable_json_repair:
                try:
                    repaired = await self._repair_summary_json_v1(
                        raw_text=raw, target_language=target_language
                    )
                    if repaired:
                        return repaired
                except:
                    pass
            return self._fallback_summary_json_v1(transcript, target_language)

    async def _repair_summary_json_v1(
        self, raw_text: str, target_language: str
    ) -> Optional[str]:
        prompt = f"The following JSON is invalid. Please fix it and return ONLY the valid JSON.\n\n{raw_text[:3000]}"
        try:
            response = await self._ainvoke_with_fallback(
                models=[self.json_repair_model],
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=2000,
                response_format={"type": "json_object"}
                if self.use_response_format_json
                else None,
            )
            raw = (response.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"JSON repair failed: {e}")
            return None

    async def _summarize_with_chunks_json(
        self,
        transcript: str,
        target_language: str,
        max_summarize_tokens: int,
        trace_metadata: dict = None,
    ) -> str:
        chunks = self._split_into_chunks(transcript, max_summarize_tokens)
        logger.info(f"Split into {len(chunks)} chunks for summarization")

        chunk_summaries = []
        language_name = self.language_map.get(target_language, "English")

        for i, chunk in enumerate(chunks):
            system_prompt = SUMMARY_CHUNK_SYSTEM.format(
                language_name=language_name, target_language=target_language
            )
            user_prompt = SUMMARY_CHUNK_USER.format(
                language_name=language_name, chunk_text=chunk
            )

            trace_config = None
            if trace_metadata:
                trace_config = {
                    "name": "Summary Chunk",
                    "metadata": {
                        **trace_metadata.get("metadata", {}),
                        "chunk_index": i,
                    },
                    **{k: v for k, v in trace_metadata.items() if k != "metadata"},
                }

            try:
                response = await self._ainvoke_with_fallback(
                    models=self.summary_models,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_completion_tokens=1000,
                    trace_config=trace_config,
                )
                chunk_summaries.append(response.content or "")
            except Exception as e:
                logger.error(f"Chunk summary failed: {e}")
                chunk_summaries.append("")

        valid_summaries = [s for s in chunk_summaries if s.strip()]
        if not valid_summaries:
            return self._fallback_summary_json_v1(transcript, target_language)

        return await self._integrate_chunk_summaries(
            valid_summaries, target_language, trace_metadata=trace_metadata
        )

    async def _integrate_chunk_summaries(
        self,
        chunk_summaries: list[str],
        target_language: str,
        trace_metadata: dict = None,
    ) -> str:
        combined = "\n\n".join(chunk_summaries)
        language_name = self.language_map.get(target_language, "English")

        system_prompt = SUMMARY_INTEGRATE_SYSTEM.format(
            language_name=language_name, target_language=target_language
        )
        user_prompt = SUMMARY_INTEGRATE_USER.format(
            language_name=language_name, combined_summaries=combined
        )

        trace_config = None
        if trace_metadata:
            trace_config = {
                "name": "Integrate Summaries",
                "metadata": {
                    **trace_metadata.get("metadata", {}),
                    "target_language": target_language,
                },
                **{k: v for k, v in trace_metadata.items() if k != "metadata"},
            }

        try:
            response = await self._ainvoke_with_fallback(
                models=self.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=int(self.summary_integrate_max_output_tokens),
                trace_config=trace_config,
                response_format={"type": "json_object"}
                if self.use_response_format_json
                else None,
            )
            raw = (response.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Integration failed: {e}")
            if self.enable_json_repair:
                try:
                    repaired = await self._repair_summary_json_v1(
                        raw_text=raw, target_language=target_language
                    )
                    if repaired:
                        return repaired
                except:
                    pass
            return self._fallback_summary_json_v1(combined, target_language)
