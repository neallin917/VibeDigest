import os
import openai
import logging
import asyncio
from typing import Optional, Any
import json
import re
from config import settings
from utils.openai_client import get_openai_client
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
    smart_chunk_text
)
from prompts import (
    OPTIMIZE_TRANSCRIPT_SYSTEM_ZH, OPTIMIZE_TRANSCRIPT_USER_ZH,
    OPTIMIZE_TRANSCRIPT_SYSTEM_EN, OPTIMIZE_TRANSCRIPT_USER_EN,
    CHUNK_OPTIMIZE_SYSTEM, CHUNK_OPTIMIZE_USER,
    ORGANIZE_PARAGRAPHS_SYSTEM, ORGANIZE_PARAGRAPHS_USER,
    ORGANIZE_CHUNK_SYSTEM, ORGANIZE_CHUNK_USER,
    SUMMARY_SINGLE_SYSTEM, SUMMARY_SINGLE_USER,
    SUMMARY_CHUNK_SYSTEM, SUMMARY_CHUNK_USER,
    SUMMARY_INTEGRATE_SYSTEM, SUMMARY_INTEGRATE_USER,
    JSON_REPAIR_SYSTEM, JSON_REPAIR_USER,
    TRANSLATE_JSON_SYSTEM,
    # V2 Classified Summary System
    CONTENT_CLASSIFIER_SYSTEM, CONTENT_CLASSIFIER_USER,
    STRUCTURE_TEMPLATES, GOAL_TEMPLATES, FORM_SUPPLEMENTS,
    SUMMARY_V2_SYSTEM_TEMPLATE, SUMMARY_V2_USER_TEMPLATE,
)

try:
    from langfuse import observe, get_client
except ImportError:
    def observe(**kwargs):
        def decorator(func):
            return func
        return decorator
    def get_client():
        return None

logger = logging.getLogger(__name__)

class Summarizer:
    """文本总结器，使用OpenAI API生成多语言摘要"""
    
    @staticmethod
    def _read_int_env(name: str, default: int, *, min_value: int | None = None, max_value: int | None = None) -> int:
        """Read an int env var with safe clamping."""
        raw = os.getenv(name)
        if raw is None or str(raw).strip() == "":
            val = int(default)
        else:
            try:
                val = int(str(raw).strip())
            except Exception:
                logger.warning(f"Invalid int env {name}={raw!r}, using default={default}")
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
        logger.warning(f"Invalid bool env {name}={raw!r}, using default={default}")
        return bool(default)

    def __init__(self):
        """初始化总结器"""
        self.client = get_openai_client()
        if self.client:
             logger.info("OpenAI客户端已初始化 (Summarizer)")
        else:
             logger.warning("未设置OPENAI_API_KEY环境变量，将无法使用摘要功能")

        # Model selection (configurable via env; safe fallbacks).
        # - Summary should use the best available model. We try preferred first, then fall back.
        # - Transcript formatting keeps the previous default to avoid cost regression unless configured.
        # If user explicitly sets env, respect it. Otherwise, use config defaults.
        # Safe due to runtime fallback in _chat_completions_create().
        explicit_summary_model = (os.getenv("OPENAI_SUMMARY_MODEL") or "").strip()
        explicit_fallback_model = (os.getenv("OPENAI_SUMMARY_FALLBACK_MODEL") or "").strip()
        
        if explicit_summary_model:
            # If explicit override, build a custom chain starting with it
            default_summary_chain = [
                explicit_summary_model,
                explicit_fallback_model,
            ] + settings.OPENAI_SUMMARY_MODELS
            # Filter out empty strings
            default_summary_chain = [m for m in default_summary_chain if m]
        else:
            # Use configured defaults
            default_summary_chain = list(settings.OPENAI_SUMMARY_MODELS) # Copy
            if explicit_fallback_model:
                 default_summary_chain.insert(1, explicit_fallback_model)

        self.summary_models = self._dedupe_models(default_summary_chain)
        # Cheap/fast defaults for "transcript optimization" (formatting/paragraphing).
        # User preference: use helper model for these simpler tasks by default.
        self.transcript_model = os.getenv("OPENAI_TRANSCRIPT_MODEL") or settings.OPENAI_HELPER_MODEL
        self.paragraph_model = os.getenv("OPENAI_PARAGRAPH_MODEL") or settings.OPENAI_HELPER_MODEL

        # -----------------------------------------------------------------
        # Quality/Stability Knobs (env configurable)
        # -----------------------------------------------------------------
        # NOTE: These are defaults optimized for "higher quality + steadier long videos".
        # - If you want cheaper/faster, lower these limits and/or reduce chunk size.
        # - Token estimator is intentionally conservative; thresholds are on *estimated* tokens.
        self.summary_single_max_est_tokens = self._read_int_env(
            "OPENAI_SUMMARY_SINGLE_MAX_EST_TOKENS", 16000, min_value=3000, max_value=120000
        )
        self.summary_chunk_max_chars = self._read_int_env(
            "OPENAI_SUMMARY_CHUNK_MAX_CHARS", 9000, min_value=2000, max_value=30000
        )
        self.summary_single_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_SINGLE_MAX_OUTPUT_TOKENS", 3200, min_value=800, max_value=8000
        )
        self.summary_chunk_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_CHUNK_MAX_OUTPUT_TOKENS", 1800, min_value=500, max_value=6000
        )
        self.summary_integrate_max_output_tokens = self._read_int_env(
            "OPENAI_SUMMARY_INTEGRATE_MAX_OUTPUT_TOKENS", 2800, min_value=800, max_value=8000
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
        self.enable_json_repair = self._read_bool_env("OPENAI_SUMMARY_JSON_REPAIR", True)
        self.json_repair_model = (os.getenv("OPENAI_JSON_REPAIR_MODEL") or "").strip() or settings.OPENAI_HELPER_MODEL
        # Model for content classification (use gpt-5-mini for cost efficiency)
        self.classifier_model = (os.getenv("OPENAI_CLASSIFIER_MODEL") or "").strip() or "gpt-5-mini"
        # Best-effort strict JSON mode (if the endpoint/model supports response_format).
        self.use_response_format_json = self._read_bool_env("OPENAI_USE_RESPONSE_FORMAT_JSON", True)
        
        # Keypoint timestamp matching threshold (lower = more fuzzy matches, higher = stricter)
        # Default lowered from 6.0 to 4.0 to catch more valid matches with slight rewording.
        self.summary_match_threshold = float(os.getenv("OPENAI_SUMMARY_MATCH_THRESHOLD", "4.0"))
        
        # 支持的语言映射
        self.language_map = LANGUAGE_MAP
        
        # 支持的语言映射
        self.language_map = LANGUAGE_MAP

    @staticmethod
    def _dedupe_models(models: list[str]) -> list[str]:
        """Remove empties/duplicates while preserving order."""
        out: list[str] = []
        seen: set[str] = set()
        for m in models:
            m = (m or "").strip()
            if not m or m in seen:
                continue
            seen.add(m)
            out.append(m)
        return out

    async def _chat_completions_create(self, *, models: list[str], trace_config: dict = None, **kwargs):
        """
        Call OpenAI Chat Completions.
        Langfuse tracing is automatic via the langfuse.openai wrapper.
        The `name` from trace_config is passed to OpenAI for trace identification.
        Session/user/tags are inherited via propagate_attributes from the caller context.
        """
        if not self.client:
            raise RuntimeError("OpenAI client is not initialized")
            
        trace_config = trace_config or {}
        call_name = trace_config.get("name", "OpenAI Call")

        last_err: Exception | None = None
        tried = []
        for model in (models or []):
            tried.append(model)
            try:
                logger.info(f"Generating [{call_name}] with model: {model}")
                
                # Pass ONLY standard kwargs to client (it rejects Langfuse args)
                # Enforce a timeout to prevent indefinite hangs
                if "timeout" not in kwargs:
                    kwargs["timeout"] = 300.0
                
                logger.info(f"Calling OpenAI with timeout={kwargs['timeout']}s, model={model}")
                
                # Langfuse v3: OpenAI client wrapper auto-traces with `name` param
                # session_id, user_id, tags are inherited from propagate_attributes
                return await asyncio.to_thread(
                    lambda m=model: self.client.chat.completions.create(
                        model=m,
                        name=call_name,  # Langfuse trace name
                        **kwargs
                    )
                )
            except Exception as e:
                last_err = e
                logger.warning(f"OpenAI chat.completions failed (model={model}), trying fallback. Error: {e}")
                continue
        raise last_err or RuntimeError(f"OpenAI chat.completions failed. Tried models={tried}")
    
    async def optimize_transcript(self, raw_transcript: str, trace_metadata: dict = None) -> str:
        """
        优化转录文本：修正错别字，按含义分段
        支持长文本自动分块处理
        
        Args:
            raw_transcript: 原始转录文本
            trace_metadata: Langfuse tracking (task_id, user_id, etc.)
            
        Returns:
            优化后的转录文本（Markdown格式）
        """
        trace_metadata = trace_metadata or {}
        trace_config = {
            "name": "Transcript Optimization",
            "metadata": {**trace_metadata.get("metadata", {}), "text_len": len(raw_transcript)},
            **{k: v for k, v in trace_metadata.items() if k != "metadata"}
        }

        try:
            if not self.client:
                # Still strip timestamps/meta so UI never shows timestamps even in fallback mode.
                logger.warning("OpenAI API不可用，返回去时间戳/元信息后的转录")
                return remove_timestamps_and_meta(raw_transcript)

            # 预处理：仅移除时间戳与元信息，保留全部口语/重复内容
            preprocessed = remove_timestamps_and_meta(raw_transcript)
            # 使用JS策略：按字符长度分块（更贴近tokens上限，避免估算误差）
            detected_lang_code = detect_language(preprocessed)
            max_chars_per_chunk = 12000  # 调优：单次 8k-12k 字符是工程最优解 (GPT-4o/Mini Context)

            if len(preprocessed) > max_chars_per_chunk:
                logger.info(f"文本较长({len(preprocessed)} chars)，启用分块优化")
                # Update config for chunking
                trace_config["metadata"]["strategy"] = "chunked"
                return await self._format_long_transcript_in_chunks(preprocessed, detected_lang_code, max_chars_per_chunk, trace_config)
            else:
                # Update config for single
                trace_config["metadata"]["strategy"] = "single"
                return await self._format_single_chunk(preprocessed, detected_lang_code, trace_config=trace_config)

        except Exception as e:
            logger.error(f"优化转录文本失败: {str(e)}")
            logger.info("返回原始转录文本")
            return raw_transcript


    def fast_clean_transcript(self, raw_transcript: str) -> str:
        """
        Fast cleanup for high-quality transcripts (e.g. Supadata).
        - Removes timestamps like **[00:12:34]** or [00:12:34]
        - Removes metadata lines if present
        - Preserves paragraph usage
        """
        if not raw_transcript:
            return ""

        # Remove timestamp markers i.e. **[MM:SS]**
        # Regex explanation:
        # \*\*?  -> Optional bold
        # \[     -> Literal [
        # \d{2}:\d{2}(?::\d{2})? -> 00:00 or 00:00:00
        # \]     -> Literal ]
        # \*\*?  -> Optional bold
        text = re.sub(r"\*\*?\[\d{1,2}:\d{2}(?::\d{2})?\]\*\*?", "", raw_transcript)
        
        # Remove empty lines that might have been left behind (but preserve double newlines for paragraphs)
        # Actually, let's just use remove_timestamps_and_meta logic which does this well, 
        # but locally here to be explicit about what "fast" means if we want to diverge.
        # But wait, remove_timestamps_and_meta is imported from utils.text_utils.
        # Let's use that directly or wrap it?
        # The prompt says "fast_clean_transcript". 
        # "remove_timestamps_and_meta" in text_utils might be exactly what we need.
        # Let's check text_utils usage in the file imports first.
        # It is imported: remove_timestamps_and_meta
        
        # Checking remove_timestamps_and_meta implementation (from memory/context):
        # Usually it strips timestamps. 
        # Let's just wrap it to ensure we have a standard interface in Summarizer.
        
        cleaned = remove_timestamps_and_meta(text)
        
        # Additional cleanup: ensure no excessive blank lines (more than 2)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        
        return cleaned.strip()

    # ---------------------------------------------------------------------
    # Structured Summary (JSON) - v1
    # ---------------------------------------------------------------------

    def _extract_first_json_object(self, text: str) -> Optional[str]:
        """Best-effort: extract the first JSON object substring from model output."""
        if not text:
            return None
        s = text.strip()
        # Remove code fences if any
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
        s = re.sub(r"\s*```$", "", s)
        # Find first '{' and last '}' after it
        start = s.find("{")
        end = s.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        return s[start : end + 1]

    def _fallback_summary_json_v1(self, transcript: str, target_language: str) -> str:
        """Deterministic fallback: always return valid JSON (current schema)."""
        cleaned = remove_timestamps_and_meta(transcript or "")
        cleaned = cleaned.strip()
        overview = cleaned[:900].strip()
        if len(cleaned) > 900:
            overview = overview + "…"

        keypoints = []
        # Take first few non-empty lines/paragraphs as coarse keypoints.
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

        payload = {
            "version": 2,
            "language": target_language,
            "overview": overview,
            "keypoints": keypoints,
        }
        return json.dumps(payload, ensure_ascii=False)

    def _estimate_tokens(self, text: str) -> int:
        """
        改进的token数量估算算法
        更保守的估算，考虑系统prompt和格式化开销
        """
        # 更保守的估算：考虑实际使用中的token膨胀
        chinese_chars = sum(1 for char in text if '\u4e00' <= char <= '\u9fff')
        english_words = len([word for word in text.split() if word.isascii() and word.isalpha()])
        
        # 计算基础tokens
        base_tokens = chinese_chars * 1.5 + english_words * 1.3
        
        # 考虑markdown格式、时间戳等开销（约30%额外开销）
        format_overhead = len(text) * 0.15
        
        # 考虑系统prompt开销（约2000-3000 tokens）
        system_prompt_overhead = self._read_int_env("OPENAI_TOKEN_ESTIMATE_OVERHEAD", 2500, min_value=0, max_value=20000)
        
        total_estimated = int(base_tokens + format_overhead + system_prompt_overhead)
        
        return total_estimated

    async def _optimize_single_chunk(self, raw_transcript: str) -> str:
        """
        优化单个文本块
        """
        detected_lang = detect_language(raw_transcript)
        
        if detected_lang == 'zh':
             system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_ZH
             user_prompt = OPTIMIZE_TRANSCRIPT_USER_ZH.format(text=raw_transcript)
        else:
             system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_EN
             user_prompt = OPTIMIZE_TRANSCRIPT_USER_EN.format(text=raw_transcript)

        response = await self._chat_completions_create(
            models=[self.transcript_model],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=4000,  # 对齐JS：优化/格式化阶段最大tokens≈4000
            # temperature=0.1,
        )
        
        return response.choices[0].message.content

    async def _optimize_with_chunks(self, raw_transcript: str, max_tokens: int) -> str:
        """
        分块优化长文本
        """
        detected_lang = detect_language(raw_transcript)
        lang_instruction = self._get_language_instruction(detected_lang)
        
        # 按段落分割原始转录（保留时间戳作为分割参考）
        chunks = self._split_into_chunks(raw_transcript, max_tokens)
        logger.info(f"分割为 {len(chunks)} 个块进行处理")
        
        optimized_chunks = []
        
        for i, chunk in enumerate(chunks):
            logger.info(f"正在优化第 {i+1}/{len(chunks)} 块...")
            
            system_prompt = CHUNK_OPTIMIZE_SYSTEM.format(
                current_part=i+1, 
                total_parts=len(chunks), 
                language=lang_instruction
            )
            user_prompt = CHUNK_OPTIMIZE_USER.format(
                language=lang_instruction, 
                text=chunk
            )

            try:
                response = await self._chat_completions_create(
                    models=[self.transcript_model],
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_completion_tokens=1200,  # 适应4000 tokens总限制
                    # temperature=0.1,
                )
                
                optimized_chunk = response.choices[0].message.content
                optimized_chunks.append(optimized_chunk)
                
            except Exception as e:
                logger.error(f"优化第 {i+1} 块失败: {e}")
                # 失败时使用基本清理
                cleaned_chunk = remove_timestamps_and_meta(chunk)
                optimized_chunks.append(cleaned_chunk)
        
        # 合并所有优化后的块
        merged_text = "\n\n".join(optimized_chunks)
        
        # 对合并后的文本进行二次段落整理
        logger.info("正在进行最终段落整理...")
        final_result = await self._final_paragraph_organization(merged_text, lang_instruction)
        
        logger.info("分块优化完成")
        return final_result

    # ===== JS openaiService.js 移植：分块/上下文/去重/格式化 =====



    async def _format_single_chunk(self, chunk_text: str, transcript_language: str = 'zh', trace_config: dict = None) -> str:
        """单块优化（修正+格式化），遵循4000 tokens 限制。"""
        # 构建系统/用户提示
        if transcript_language == 'zh':
            system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_ZH
            prompt = OPTIMIZE_TRANSCRIPT_USER_ZH.format(text=chunk_text)
        else:
            system_prompt = OPTIMIZE_TRANSCRIPT_SYSTEM_EN
            prompt = OPTIMIZE_TRANSCRIPT_USER_EN.format(text=chunk_text)

        try:
            response = await self._chat_completions_create(
                models=[self.transcript_model],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                max_completion_tokens=14000,
                trace_config=trace_config,
                # temperature=0.1, # gpt-5-mini only supports default temperature (1)
            )
            optimized_text = response.choices[0].message.content or ""
            # 移除诸如 "# Transcript" / "## Transcript" 等标题
            optimized_text = remove_transcript_heading(optimized_text)
            enforced = enforce_paragraph_max_chars(optimized_text.strip(), max_chars=400)
            return ensure_markdown_paragraphs(enforced)
        except Exception as e:
            logger.error(f"单块文本优化失败: {e}")
            return self._apply_basic_formatting(chunk_text)

    def _smart_split_long_chunk(self, text: str, max_chars_per_chunk: int) -> list:
        """在句子/空格边界处安全切分超长文本。"""
        chunks = []
        pos = 0
        while pos < len(text):
            end = min(pos + max_chars_per_chunk, len(text))
            if end < len(text):
                # 优先句子边界
                sentence_endings = ['。', '！', '？', '.', '!', '?']
                best = -1
                for ch in sentence_endings:
                    idx = text.rfind(ch, pos, end)
                    if idx > best:
                        best = idx
                if best > pos + int(max_chars_per_chunk * 0.7):
                    end = best + 1
                else:
                    # 次选：空格边界
                    space_idx = text.rfind(' ', pos, end)
                    if space_idx > pos + int(max_chars_per_chunk * 0.8):
                        end = space_idx
            chunks.append(text[pos:end].strip())
            pos = end
        return [c for c in chunks if c]

    def _find_safe_cut_point(self, text: str) -> int:
        """找到安全的切割点（段落>句子>短语）。"""
        import re
        # 段落
        p = text.rfind("\n\n")
        if p > 0:
            return p + 2
        # 句子
        last_sentence_end = -1
        for m in re.finditer(r"[。！？\.!?]\s*", text):
            last_sentence_end = m.end()
        if last_sentence_end > 20:
            return last_sentence_end
        # 短语
        last_phrase_end = -1
        for m in re.finditer(r"[，；,;]\s*", text):
            last_phrase_end = m.end()
        if last_phrase_end > 20:
            return last_phrase_end
        return len(text)

    def _find_overlap_between_texts(self, text1: str, text2: str) -> str:
        """检测相邻两段的重叠内容，用于去重。"""
        max_len = min(len(text1), len(text2))
        # 逐步从长到短尝试
        for length in range(max_len, 19, -1):
            suffix = text1[-length:]
            prefix = text2[:length]
            if suffix == prefix:
                cut = self._find_safe_cut_point(prefix)
                if cut > 20:
                    return prefix[:cut]
                return suffix
        return ""

    def _apply_basic_formatting(self, text: str) -> str:
        """当AI失败时的回退：按句子拼段，段落≤250字符，双换行分隔。"""
        if not text or not text.strip():
            return text
        import re
        parts = re.split(r"([。！？\.!?]+\s*)", text)
        sentences = []
        current = ""
        for i, part in enumerate(parts):
            if i % 2 == 0:
                current += part
            else:
                current += part
                if current.strip():
                    sentences.append(current.strip())
                    current = ""
        if current.strip():
            sentences.append(current.strip())
        paras = []
        cur = ""
        sentence_count = 0
        for s in sentences:
            candidate = (cur + " " + s).strip() if cur else s
            sentence_count += 1
            # 改进的分段逻辑：考虑句子数量和长度
            should_break = False
            if len(candidate) > 400 and cur:  # 段落过长
                should_break = True
            elif len(candidate) > 200 and sentence_count >= 3:  # 中等长度且句子数足够
                should_break = True
            elif sentence_count >= 6:  # 句子数过多
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

    async def _format_long_transcript_in_chunks(self, raw_transcript: str, transcript_language: str, max_chars_per_chunk: int, trace_config: dict = None) -> str:
        """智能分块+上下文+去重 合成优化文本（JS策略移植）。"""
        """智能分块+上下文+去重 合成优化文本（JS策略移植）。"""
        import re
        # 先按句子切分，组装不超过max_chars_per_chunk的块
        parts = re.split(r"([。！？\.!?]+\s*)", raw_transcript)
        sentences = []
        buf = ""
        for i, part in enumerate(parts):
            if i % 2 == 0:
                buf += part
            else:
                buf += part
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

        # 对仍然过长的块二次安全切分
        final_chunks = []
        for c in chunks:
            if len(c) <= max_chars_per_chunk:
                final_chunks.append(c)
            else:
                final_chunks.extend(self._smart_split_long_chunk(c, max_chars_per_chunk))

        logger.info(f"文本分为 {len(final_chunks)} 块处理")

        optimized = []
        for i, c in enumerate(final_chunks):
            chunk_with_context = c
            if i > 0:
                prev_tail = final_chunks[i - 1][-100:]
                marker = f"[上文续：{prev_tail}]" if transcript_language == 'zh' else f"[Context continued: {prev_tail}]"
                chunk_with_context = marker + "\n\n" + c
            try:
                # Sub-traces for chunks? Or just share same parent trace?
                # OpenAI call will be a separate generation unless we group them carefully.
                # Just passing same config will create sibling traces or spans depending on how Langfuse client handles it.
                # Ideally parameters should indicate chunk index.
                chunk_config = None
                if trace_config:
                    chunk_config = trace_config.copy()
                    if "metadata" in chunk_config:
                        chunk_config["metadata"] = chunk_config["metadata"].copy()
                        chunk_config["metadata"]["chunk_index"] = i
                
                oc = await self._format_single_chunk(chunk_with_context, transcript_language, trace_config=chunk_config)
                # 移除上下文标记
                oc = re.sub(r"^\[(上文续|Context continued)：?:?.*?\]\s*", "", oc, flags=re.S)
                optimized.append(oc)
            except Exception as e:
                logger.warning(f"第 {i+1} 块优化失败，使用基础格式化: {e}")
                optimized.append(self._apply_basic_formatting(c))

        # 邻接块去重
        deduped = []
        for i, c in enumerate(optimized):
            cur_txt = c
            if i > 0 and deduped:
                prev = deduped[-1]
                overlap = self._find_overlap_between_texts(prev[-200:], cur_txt[:200])
                if overlap:
                    cur_txt = cur_txt[len(overlap):].lstrip()
                    if not cur_txt:
                        continue
            if cur_txt.strip():
                deduped.append(cur_txt)

        merged = "\n\n".join(deduped)
        merged = remove_transcript_heading(merged)
        enforced = enforce_paragraph_max_chars(merged, max_chars=400)
        return ensure_markdown_paragraphs(enforced)



    def _split_into_chunks(self, text: str, max_tokens: int) -> list:
        """
        将原始转录文本智能分割成合适大小的块
        策略：先提取纯文本，按句子和段落自然分割
        """
        import re
        
        # 1. 先提取纯文本内容（移除时间戳、标题等）
        pure_text = extract_pure_text(text)
        
        # 2. 按句子分割，保持句子完整性
        sentences = split_into_sentences(pure_text)
        
        # 3. 按token限制组装成块
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for sentence in sentences:
            sentence_tokens = self._estimate_tokens(sentence)
            
            # 检查是否能加入当前块
            if current_tokens + sentence_tokens > max_tokens and current_chunk:
                # 当前块已满，保存并开始新块
                chunks.append(join_sentences(current_chunk))
                current_chunk = [sentence]
                current_tokens = sentence_tokens
            else:
                # 添加到当前块
                current_chunk.append(sentence)
                current_tokens += sentence_tokens
        
        # 添加最后一块
        if current_chunk:
            chunks.append(join_sentences(current_chunk))
        
        return chunks
    




    async def _final_paragraph_organization(self, text: str, lang_instruction: str) -> str:
        """
        对合并后的文本进行最终的段落整理
        使用改进的prompt和工程验证
        """
        try:
            # 估算文本长度，如果太长则分块处理
            estimated_tokens = self._estimate_tokens(text)
            if estimated_tokens > 3000:  # 对于很长的文本，分块处理
                return await self._organize_long_text_paragraphs(text, lang_instruction)
            
            system_prompt = ORGANIZE_PARAGRAPHS_SYSTEM.format(lang_instruction=lang_instruction)
            user_prompt = ORGANIZE_PARAGRAPHS_USER.format(lang_instruction=lang_instruction, text=text)

            response = await self._chat_completions_create(
                models=[self.paragraph_model],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=4000,  # 对齐JS：段落整理阶段最大tokens≈4000
                # temperature=0.05,  # 降低温度，提高一致性
            )
            
            organized_text = response.choices[0].message.content
            
            # 工程验证：检查段落长度
            validated_text = self._validate_paragraph_lengths(organized_text)
            
            return validated_text
            
        except Exception as e:
            logger.error(f"最终段落整理失败: {e}")
            # 失败时使用基础分段处理
            return self._basic_paragraph_fallback(text)

    async def _organize_long_text_paragraphs(self, text: str, lang_instruction: str) -> str:
        """
        对于很长的文本，分块进行段落整理
        """
        try:
            # 按现有段落分割
            paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
            organized_chunks = []
            
            current_chunk = []
            current_tokens = 0
            max_chunk_tokens = 2500  # 适应4000 tokens限制的chunk大小
            
            for para in paragraphs:
                para_tokens = self._estimate_tokens(para)
                
                if current_tokens + para_tokens > max_chunk_tokens and current_chunk:
                    # 处理当前chunk
                    chunk_text = '\n\n'.join(current_chunk)
                    organized_chunk = await self._organize_single_chunk(chunk_text, lang_instruction)
                    organized_chunks.append(organized_chunk)
                    
                    current_chunk = [para]
                    current_tokens = para_tokens
                else:
                    current_chunk.append(para)
                    current_tokens += para_tokens
            
            # 处理最后一个chunk
            if current_chunk:
                chunk_text = '\n\n'.join(current_chunk)
                organized_chunk = await self._organize_single_chunk(chunk_text, lang_instruction)
                organized_chunks.append(organized_chunk)
            
            return '\n\n'.join(organized_chunks)
            
        except Exception as e:
            logger.error(f"长文本段落整理失败: {e}")
            return self._basic_paragraph_fallback(text)

    async def _organize_single_chunk(self, text: str, lang_instruction: str) -> str:
        """
        整理单个文本块的段落
        """
        system_prompt = ORGANIZE_CHUNK_SYSTEM.format(lang_instruction=lang_instruction)
        user_prompt = ORGANIZE_CHUNK_USER.format(lang_instruction=lang_instruction, text=text)

        response = await self._chat_completions_create(
            models=[self.paragraph_model],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=1200,  # 适应4000 tokens总限制
            # temperature=0.05,
        )
        
        return response.choices[0].message.content

    def _validate_paragraph_lengths(self, text: str) -> str:
        """
        验证段落长度，如果有超长段落则尝试分割
        """
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        validated_paragraphs = []
        
        for para in paragraphs:
            word_count = len(para.split())
            
            if word_count > 300:  # 如果段落超过300词
                logger.warning(f"检测到超长段落({word_count}词)，尝试分割")
                # 尝试按句子分割长段落
                split_paras = self._split_long_paragraph(para)
                validated_paragraphs.extend(split_paras)
            else:
                validated_paragraphs.append(para)
        
        return '\n\n'.join(validated_paragraphs)

    def _split_long_paragraph(self, paragraph: str) -> list:
        """
        分割过长的段落
        """
        import re
        
        # 按句子分割
        sentences = re.split(r'[.!?。！？]\s+', paragraph)
        sentences = [s.strip() + '.' for s in sentences if s.strip()]
        
        split_paragraphs = []
        current_para = []
        current_words = 0
        
        for sentence in sentences:
            sentence_words = len(sentence.split())
            
            if current_words + sentence_words > 200 and current_para:
                # 当前段落达到长度限制
                split_paragraphs.append(' '.join(current_para))
                current_para = [sentence]
                current_words = sentence_words
            else:
                current_para.append(sentence)
                current_words += sentence_words
        
        # 添加最后一段
        if current_para:
            split_paragraphs.append(' '.join(current_para))
        
        return split_paragraphs

    def _basic_paragraph_fallback(self, text: str) -> str:
        """
        基础分段fallback机制
        当GPT整理失败时，使用简单的规则分段
        """
        import re
        
        # 移除多余的空行
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        basic_paragraphs = []
        
        for para in paragraphs:
            word_count = len(para.split())
            
            if word_count > 250:
                # 长段落按句子分割
                split_paras = self._split_long_paragraph(para)
                basic_paragraphs.extend(split_paras)
            elif word_count < 30 and basic_paragraphs:
                # 短段落与上一段合并（如果合并后不超过200词）
                last_para = basic_paragraphs[-1]
                combined_words = len(last_para.split()) + word_count
                
                if combined_words <= 200:
                    basic_paragraphs[-1] = last_para + ' ' + para
                else:
                    basic_paragraphs.append(para)
            else:
                basic_paragraphs.append(para)
        
        return '\n\n'.join(basic_paragraphs)

    async def summarize(
        self,
        transcript: str,
        target_language: str = "zh",
        video_title: str = None,
        existing_classification: dict | None = None,
        trace_metadata: dict = None,
    ) -> str:
        """
        生成视频转录的摘要
        
        Args:
            transcript: 转录文本
            target_language: 目标语言代码
            video_title: 视频标题（可选）
            existing_classification: 已有的分类结果（可选，V2策略可复用）
            
        Returns:
            摘要文本（JSON格式）
        """
        try:
            if not self.client:
                logger.warning("OpenAI API不可用，生成备用结构化摘要(JSON)")
                return self._fallback_summary_json_v1(transcript, target_language)
            
            # Normalize language code to ensure we get the correct language name
            target_language = self._normalize_lang_code(target_language)
            
            # Check strategy setting
            if settings.SUMMARY_STRATEGY == "v2_classified":
                logger.info("使用 V2 三层分类总结策略")
                return await self._summarize_v2_classified(
                    transcript,
                    target_language,
                    existing_classification=existing_classification,
                    trace_metadata=trace_metadata,
                )
            
            # Legacy strategy: generic prompt
            # 估算转录文本长度，决定是否需要分块摘要
            estimated_tokens = self._estimate_tokens(transcript)
            max_summarize_tokens = int(self.summary_single_max_est_tokens)
            
            if estimated_tokens <= max_summarize_tokens:
                # 短文本直接摘要
                return await self._summarize_single_text_json(transcript, target_language, trace_metadata=trace_metadata)
            else:
                # 长文本分块摘要
                logger.info(f"文本较长({estimated_tokens} tokens)，启用分块摘要")
                return await self._summarize_with_chunks_json(transcript, target_language, max_summarize_tokens, trace_metadata=trace_metadata)
            
        except Exception as e:
            logger.error(f"生成摘要失败: {str(e)}")
            return self._fallback_summary_json_v1(transcript, target_language)


    # =========================================================================
    # V2 CLASSIFIED SUMMARY SYSTEM
    # Three-layer classification for adaptive summarization
    # =========================================================================

    async def classify_content(self, transcript: str, trace_metadata: dict = None) -> dict:
        """
        Classify transcript across 3 dimensions: content_form, info_structure, cognitive_goal.
        Returns classification dict with confidence score.
        
        This is a public method that can be called independently for testing/debugging.
        """
        # Use full transcript for classification (no sampling)
        transcript_sample = transcript

        system_prompt = CONTENT_CLASSIFIER_SYSTEM
        user_prompt = CONTENT_CLASSIFIER_USER.format(transcript_sample=transcript_sample)

        try:
            kwargs = dict(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=500,  # GPT-5-mini needs more tokens than older models
            )
            
            # Langfuse v3: Always set trace_config with name
            trace_config = {"name": "Content Classification"}
            if trace_metadata:
                trace_config.update({
                    k: v for k, v in trace_metadata.items() if k != "metadata"
                })
                trace_config["metadata"] = {**trace_metadata.get("metadata", {})}

            if self.use_response_format_json:
                kwargs["response_format"] = {"type": "json_object"}

            response = await self._chat_completions_create(
                models=[self.classifier_model],  # Use classifier_model (default: gpt-5-chat-latest)
                trace_config=trace_config,
                **kwargs
            )
            raw = (response.choices[0].message.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            classification = json.loads(json_text)
            
            # Validate and normalize
            valid_forms = {"tutorial", "interview", "monologue", "news", "review", "finance", "narrative", "casual"}
            valid_structures = {"hierarchical", "sequential", "argumentative", "comparative", "narrative_arc", "thematic", "qa_format", "data_driven"}
            valid_goals = {"understand", "decide", "execute", "inspire", "digest"}
            
            content_form = classification.get("content_form", "casual")
            if content_form not in valid_forms:
                content_form = "casual"
            
            info_structure = classification.get("info_structure", "thematic")
            if info_structure not in valid_structures:
                info_structure = "thematic"
            
            cognitive_goal = classification.get("cognitive_goal", "digest")
            if cognitive_goal not in valid_goals:
                cognitive_goal = "digest"
            
            confidence = float(classification.get("confidence", 0.5))
            
            result = {
                "content_form": content_form,
                "info_structure": info_structure,
                "cognitive_goal": cognitive_goal,
                "confidence": confidence,
            }
            logger.info(f"内容分类结果: {result}")
            return result
            
        except Exception as e:
            logger.warning(f"内容分类失败，使用默认值: {e}")
            return {
                "content_form": "casual",
                "info_structure": "thematic",
                "cognitive_goal": "digest",
                "confidence": 0.0,
            }

    def _build_v2_dynamic_prompt(
        self,
        classification: dict,
        language_name: str,
        target_language: str,
    ) -> tuple[str, str]:
        """
        Build dynamic system and user prompts based on 3-layer classification.
        Returns (system_prompt, user_prompt_template).
        """
        content_form = classification.get("content_form", "casual")
        info_structure = classification.get("info_structure", "thematic")
        cognitive_goal = classification.get("cognitive_goal", "digest")

        # Get templates (with fallbacks)
        structure_instruction = STRUCTURE_TEMPLATES.get(info_structure, STRUCTURE_TEMPLATES["thematic"])
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
        """
        V2 Classified Summary: classify content first, then generate summary with dynamic prompt.
        
        Args:
            transcript: The transcript text
            target_language: Target language code
            existing_classification: If provided, skip classification and use this result
        """
        language_name = self.language_map.get(target_language, "English")

        # Step 1: Classify content (or use existing)
        if existing_classification:
            classification = existing_classification
            logger.info(f"使用已有分类结果: {classification}")
        else:
            classification = await self.classify_content(transcript, trace_metadata=trace_metadata)

        # Step 2: Build dynamic prompt
        system_prompt = self._build_v2_dynamic_prompt(classification, language_name, target_language)
        
        # Format human-readable content type for prompt reinforcement
        content_type_info = (
            f"Form: {classification.get('content_form')}, "
            f"Structure: {classification.get('info_structure')}, "
            f"Goal: {classification.get('cognitive_goal')}"
        )
        
        user_prompt = SUMMARY_V2_USER_TEMPLATE.format(
            language_name=language_name,
            transcript=transcript,
            content_type_info=content_type_info,
        )

        logger.info(f"使用 V2 分类生成摘要: form={classification['content_form']}, "
                    f"structure={classification['info_structure']}, goal={classification['cognitive_goal']}")

        # Step 3: Generate summary
        kwargs = dict(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=int(self.summary_single_max_output_tokens),
        )

        # Langfuse v3: Always set trace_config with name
        trace_config = {"name": "Summary Generation (V2)"}
        if trace_metadata:
            combined_meta = trace_metadata.get("metadata", {}).copy()
            combined_meta.update({
                "content_form": classification.get("content_form"),
                "info_structure": classification.get("info_structure"),
                "cognitive_goal": classification.get("cognitive_goal"),
                "language": target_language
            })
            trace_config.update({
                k: v for k, v in trace_metadata.items() if k != "metadata"
            })
            trace_config["metadata"] = combined_meta

        if self.use_response_format_json:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            response = await self._chat_completions_create(models=self.summary_models, trace_config=trace_config, **kwargs)
        except Exception as e:
            if self.use_response_format_json and "response_format" in str(e):
                logger.warning(f"response_format not supported, retrying without it. Error: {e}")
                kwargs.pop("response_format", None)
                response = await self._chat_completions_create(models=self.summary_models, trace_config=trace_config, **kwargs)
            else:
                raise

        raw = (response.choices[0].message.content or "").strip()
        json_text = self._extract_first_json_object(raw) or raw

        try:
            obj = json.loads(json_text)
            # Ensure content_type is in the output
            if "content_type" not in obj:
                obj["content_type"] = classification
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"V2 Summary JSON parse/validate failed. Error: {e}")
            if self.enable_json_repair:
                repaired = await self._repair_summary_json_v1(raw_text=raw, target_language=target_language)
                if repaired:
                    return repaired
            return self._fallback_summary_json_v1(transcript, target_language)

    # ---------------------------------------------------------------------
    # Timed Summary (inject start/end seconds from script_raw segments) - v2
    # ---------------------------------------------------------------------

    def _normalize_lang_code(self, lang: Optional[str]) -> str:
        """
        Best-effort normalize to base language code for routing/labels.
        Handles cases like 'zh-CN' -> 'zh', 'Chinese' -> 'zh'.
        """
        if not lang:
            return "unknown"
        s = str(lang).strip().lower()
        
        # Handle full names often returned by OpenAI/Whisper
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
            "russian": "ru"
        }
        if s in name_map:
            return name_map[s]
            
        # Handle variants like zh-CN (replace _ with - first just in case)
        s = s.replace("_", "-")
        if not s:
            return "unknown"
        
        # Special case for Chinese variants if we want to map them all to 'zh' generally, 
        # or keep them if they exist in language_map. 
        # But for 'zh-CN' specifically, we often want 'zh' behavior in our prompts unless we have specific prompts.
        # Given language_map keys now include zh-cn, we can just return it? 
        # BUT our prompts might rely on 'zh' key in other lookups? 
        # Actually existing lookups use `self.language_map.get(target_language, "English")`.
        # So as long as `zh-cn` is in `language_map`, it's fine.
        
        # However, to be safe and consistent with other logic that might expect 2-char codes:
        if s.startswith("zh-"):
            return "zh"
            
        base = s.split("-")[0]
        return base or "unknown"

    def _parse_script_raw_payload(self, script_raw_json: Optional[str]) -> tuple[str, list[dict]]:
        """Return (language, segments[{start,end,text}]) from task_outputs(kind='script_raw').content."""
        if not script_raw_json:
            return "unknown", []
        try:
            payload = json.loads(script_raw_json)
        except Exception:
            return "unknown", []
        if not isinstance(payload, dict):
            return "unknown", []
        lang = self._normalize_lang_code(payload.get("language"))
        segs = payload.get("segments", [])
        if not isinstance(segs, list):
            return lang, []
        out: list[dict] = []
        for s in segs:
            if not isinstance(s, dict):
                continue
            start = s.get("start", None)
            end = s.get("end", None)
            text = s.get("text", "")
            try:
                start_f = float(start)
            except Exception:
                continue
            if start_f < 0 or not (start_f == start_f):  # NaN guard
                continue
            try:
                end_f = float(end) if end is not None else start_f
            except Exception:
                end_f = start_f
            if end_f < start_f:
                end_f = start_f
            text_s = str(text or "").strip()
            if not text_s:
                continue
            out.append({"start": start_f, "end": end_f, "text": text_s})
        return lang, out

    @staticmethod
    def _build_keypoint_query(kp: dict) -> str:
        """Build a compact query string for aligning a keypoint to transcript segments (same-language)."""
        if not isinstance(kp, dict):
            return ""
        title = str(kp.get("title", "") or "").strip()
        detail = str(kp.get("detail", "") or "").strip()
        evidence = str(kp.get("evidence", "") or "").strip()
        parts: list[str] = []
        if evidence:
            parts.append(evidence)
        if title:
            parts.append(title)
        if detail:
            parts.append(detail[:220])
        return " ".join([p for p in parts if p]).strip()

    @staticmethod
    def _is_cjk_text(text: str) -> bool:
        if not text:
            return False
        # Fast heuristic: any CJK char implies CJK-like tokenization works better
        return any("\u4e00" <= ch <= "\u9fff" for ch in text)

    @staticmethod
    def _normalize_for_match(text: str) -> str:
        s = (text or "").lower()
        # Keep alnum + CJK; drop punctuation/whitespace
        s = re.sub(r"[^\w\u4e00-\u9fff]+", " ", s, flags=re.UNICODE)
        return re.sub(r"\s+", " ", s).strip()

    def _tokenize_for_match(self, text: str) -> set[str]:
        s = self._normalize_for_match(text)
        if not s:
            return set()
        if self._is_cjk_text(s):
            compact = s.replace(" ", "")
            if len(compact) <= 1:
                return {compact} if compact else set()
            # Character bigrams work decently across zh/ja without external deps
            return {compact[i : i + 2] for i in range(len(compact) - 1)}
        # Non-CJK: word tokens
        return {t for t in s.split(" ") if len(t) >= 2}

    def _score_segment_match(self, *, query: str, query_tokens: set[str], seg_text: str, seg_tokens: set[str]) -> float:
        """
        Score how well a transcript segment matches a query (keypoint).
        Higher is better. Purely heuristic; must be robust across languages.
        """
        if not seg_text:
            return 0.0
        qn = self._normalize_for_match(query)
        sn = self._normalize_for_match(seg_text)
        if not qn or not sn:
            return 0.0
        score = 0.0
        # Exact substring gets a big boost (best signal)
        if len(qn) >= 8 and qn in sn:
            score += 30.0
        # Token overlap
        if query_tokens and seg_tokens:
            inter = len(query_tokens & seg_tokens)
            # Normalize by query size to prefer "explains the same thing" rather than long segments
            score += 12.0 * (inter / max(1, len(query_tokens)))
            # Small extra for absolute overlap
            score += min(8.0, float(inter))
        # Slightly prefer shorter segments (less likely to be "everything")
        score -= min(3.0, len(sn) / 280.0)
        return score

    def _inject_keypoint_timestamps(self, summary_obj: dict, segments: list[dict]) -> dict:
        """
        Add startSeconds/endSeconds to keypoints by aligning to script_raw segments.
        Backward compatible: if alignment fails, leaves keypoint untouched.
        """
        if not isinstance(summary_obj, dict):
            return summary_obj
        kps = summary_obj.get("keypoints", [])
        if not isinstance(kps, list) or not segments:
            return summary_obj

        # Precompute segment token sets (perf)
        seg_cache: list[tuple[dict, set[str]]] = []
        for s in segments:
            seg_cache.append((s, self._tokenize_for_match(s.get("text", ""))))

        for kp in kps:
            if not isinstance(kp, dict):
                continue
            # Don't override if already present
            if isinstance(kp.get("startSeconds"), (int, float)) and kp.get("startSeconds") is not None:
                continue
            query = self._build_keypoint_query(kp)
            if not query:
                continue

            q_tokens = self._tokenize_for_match(query)
            best = None
            best_score = -1e9

            # Calculate scores for all segments first
            scores = []
            for i, (seg, seg_tokens) in enumerate(seg_cache):
                s_text = seg.get("text", "")
                sc = self._score_segment_match(query=query, query_tokens=q_tokens, seg_text=s_text, seg_tokens=seg_tokens)
                scores.append(sc)

            if not scores:
                continue

            # Find best match
            best_idx = -1
            best_score = -1e9
            for i, sc in enumerate(scores):
                if sc > best_score:
                    best_score = sc
                    best_idx = i

            # Threshold check
            if best_idx == -1 or best_score < self.summary_match_threshold:
                continue

            # Expand window logic
            # 1. Expand while neighbors have decent scores (e.g., > 60% of peak or > threshold)
            # 2. Heuristic: specific duration target?
            start_idx = best_idx
            end_idx = best_idx
            
            # Expansion thresholds
            expansion_ratio = 0.6  # Neighbor must be at least 60% of the peak score
            min_expansion_score = self.summary_match_threshold * 0.8 # Or absolute threshold

            # Expand Left
            while start_idx > 0:
                prev_score = scores[start_idx - 1]
                if prev_score >= best_score * expansion_ratio or prev_score > min_expansion_score:
                    start_idx -= 1
                else:
                    break
            
            # Expand Right
            while end_idx < len(segments) - 1:
                next_score = scores[end_idx + 1]
                if next_score >= best_score * expansion_ratio or next_score > min_expansion_score:
                    end_idx += 1
                else:
                    break
            
            # Minimum Duration Heuristic (Optional):
            # If total duration < 5s, and neighbors are not garbage (score > 0), pull them in?
            # Let's be conservative. If we have a very strong peak but short, maybe it's just that sentence.
            # But usually keypoints are broader.
            # Let's enforce: if duration < 8s, try to expand one more step if score > low_threshold
            
            current_start = float(segments[start_idx].get("start", 0.0))
            current_end = float(segments[end_idx].get("end", current_start))
            duration = current_end - current_start
            
            low_threshold = 2.0 # Very low threshold just to ensure it's not completely unrelated
            
            if duration < 8.0:
                # Try expand left
                if start_idx > 0 and scores[start_idx - 1] > low_threshold:
                    start_idx -= 1
                    current_start = float(segments[start_idx].get("start", current_start))
                    duration = current_end - current_start
                
                # If still short, try expand right
                if duration < 8.0 and end_idx < len(segments) - 1 and scores[end_idx + 1] > low_threshold:
                    end_idx += 1
                    current_end = float(segments[end_idx].get("end", current_end))

            try:
                kp["startSeconds"] = float(segments[start_idx].get("start", 0.0))
                kp["endSeconds"] = float(segments[end_idx].get("end", kp["startSeconds"]))
            except Exception:
                continue

        # Bump version to indicate timed keypoints are available
        try:
            summary_obj["version"] = max(int(summary_obj.get("version", 1) or 1), 2)
        except Exception:
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
        """
        Generate summary JSON in the specified language, then inject timestamps into keypoints using script_raw segments.
        This should be used for the stable `summary_source` (transcript language).
        
        Args:
            existing_classification: Pre-computed classification result (for V2 strategy reuse)
        """
        base = await self.summarize(
            transcript,
            summary_language,
            video_title,
            existing_classification=existing_classification,
            trace_metadata=trace_metadata,
        )
        _, segments = self._parse_script_raw_payload(script_raw_json)
        if not segments:
            return base
        try:
            obj = json.loads(base)
            if isinstance(obj, dict):
                obj = self._inject_keypoint_timestamps(obj, segments)
                return json.dumps(obj, ensure_ascii=False)
            return base
        except Exception:
            return base

    def _validate_summary_json_v1(self, obj: dict, target_language: str) -> dict:
        """Coerce/validate summary JSON to our current schema (legacy name kept for compatibility)."""
        if not isinstance(obj, dict):
            raise ValueError("Summary JSON must be an object")

        version = obj.get("version", 2)
        language = obj.get("language", target_language)
        overview = obj.get("overview", "")
        keypoints = obj.get("keypoints", [])

        if not isinstance(version, int):
            version = 2
        if not isinstance(language, str) or not language:
            language = target_language
        if not isinstance(overview, str):
            overview = str(overview) if overview is not None else ""

        normalized_kps = []
        if isinstance(keypoints, list):
            for kp in keypoints:
                if not isinstance(kp, dict):
                    continue
                title = kp.get("title", "")
                detail = kp.get("detail", "")
                evidence = kp.get("evidence", "")
                start_seconds = kp.get("startSeconds", None)
                end_seconds = kp.get("endSeconds", None)
                if not isinstance(title, str):
                    title = str(title) if title is not None else ""
                if not isinstance(detail, str):
                    detail = str(detail) if detail is not None else ""
                if not isinstance(evidence, str):
                    evidence = str(evidence) if evidence is not None else ""
                title = title.strip()
                detail = detail.strip()
                evidence = evidence.strip()
                if not title and not detail:
                    continue
                out_kp: dict = {
                    "title": title or detail[:48] or "Key Point",
                    "detail": detail,
                    "evidence": evidence,
                }
                if isinstance(start_seconds, (int, float)) and start_seconds is not None and float(start_seconds) == float(start_seconds):
                    out_kp["startSeconds"] = float(start_seconds)
                if isinstance(end_seconds, (int, float)) and end_seconds is not None and float(end_seconds) == float(end_seconds):
                    out_kp["endSeconds"] = float(end_seconds)
                normalized_kps.append(out_kp)

        return {
            "version": int(version),
            "language": language,
            "overview": overview.strip(),
            "keypoints": normalized_kps,
        }

    async def translate_summary_json(self, summary_json: str, *, target_language: str, trace_metadata: dict = None) -> str:
        """
        Translate a summary JSON into target_language while preserving structure and timestamps.
        Only title/detail/evidence are translated; startSeconds/endSeconds are kept.
        """
        if not summary_json:
            return summary_json
        try:
            src_obj = json.loads(summary_json)
        except Exception:
            return summary_json
        if not isinstance(src_obj, dict):
            return summary_json

        # Normalize before translating to ensure predictable structure
        src_obj = self._validate_summary_json_v1(src_obj, str(src_obj.get("language") or "unknown"))

        if not self.client:
            # No translation available; return the original
            return json.dumps(src_obj, ensure_ascii=False)

        tgt = self._normalize_lang_code(target_language)
        language_name = self.language_map.get(tgt, tgt)

        system_prompt = TRANSLATE_JSON_SYSTEM.format(language_name=language_name, target_language=tgt)

        user_prompt = json.dumps(
            {
                "targetLanguage": tgt,
                "input": src_obj,
            },
            ensure_ascii=False,
        )

        kwargs = dict(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=max(1200, int(self.summary_integrate_max_output_tokens)),
            # temperature=0.1,
        )

        # Langfuse v3: Always set trace_config with name, even if trace_metadata is not provided
        trace_config = {"name": "Translate Summary"}
        if trace_metadata:
            trace_config.update({
                k: v for k, v in trace_metadata.items() if k != "metadata"
            })
            trace_config["metadata"] = {**trace_metadata.get("metadata", {}), "target_language": target_language}

        if self.use_response_format_json:
            kwargs["response_format"] = {"type": "json_object"}

        try:
            resp = await self._chat_completions_create(models=self.summary_models, trace_config=trace_config, **kwargs)
            raw = (resp.choices[0].message.content or "").strip()
            json_text = self._extract_first_json_object(raw) or raw
            out_obj = json.loads(json_text)
            if isinstance(out_obj, dict):
                out_obj = self._validate_summary_json_v1(out_obj, tgt)
                # Force target language
                out_obj["language"] = tgt
                out_obj["version"] = max(int(out_obj.get("version", 2) or 2), 2)
                return json.dumps(out_obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"translate_summary_json failed: {e}")

        # Fallback: return source summary
        return json.dumps(src_obj, ensure_ascii=False)

    async def _summarize_single_text_json(self, transcript: str, target_language: str, trace_metadata: dict = None) -> str:
        """Generate structured summary JSON (v1) for a single text."""
        language_name = self.language_map.get(target_language, "English")
        
        system_prompt = SUMMARY_SINGLE_SYSTEM.format(language_name=language_name, target_language=target_language)
        user_prompt = SUMMARY_SINGLE_USER.format(language_name=language_name, transcript=transcript)

        logger.info(f"正在生成结构化{language_name}摘要(JSON)...")

        kwargs = dict(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_completion_tokens=int(self.summary_single_max_output_tokens),
            # temperature=0.2,
        )
        # Best-effort strict JSON output.
        if self.use_response_format_json:
            kwargs["response_format"] = {"type": "json_object"}
            
        # Langfuse v3: Always set trace_config with name
        trace_config = {"name": "Summary Generation (Single)"}
        if trace_metadata:
            trace_config.update({
                k: v for k, v in trace_metadata.items() if k != "metadata"
            })
            trace_config["metadata"] = {**trace_metadata.get("metadata", {}), "target_language": target_language}

        try:
            response = await self._chat_completions_create(models=self.summary_models, trace_config=trace_config, **kwargs)
        except Exception as e:
            # Some endpoints/models don't support response_format. Retry without it.
            if self.use_response_format_json and "response_format" in str(e):
                logger.warning(f"response_format not supported, retrying without it. Error: {e}")
                kwargs.pop("response_format", None)
                response = await self._chat_completions_create(models=self.summary_models, trace_config=trace_config, **kwargs)
            else:
                raise
        
        raw = (response.choices[0].message.content or "").strip()
        json_text = self._extract_first_json_object(raw) or raw
        try:
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Summary JSON parse/validate failed. Error: {e}")
            if self.enable_json_repair:
                repaired = await self._repair_summary_json_v1(raw_text=raw, target_language=target_language)
                if repaired:
                    return repaired
            return self._fallback_summary_json_v1(transcript, target_language)

    async def _summarize_with_chunks_json(self, transcript: str, target_language: str, max_tokens: int, trace_metadata: dict = None) -> str:
        """Chunked summarization -> structured JSON (v1)."""
        language_name = self.language_map.get(target_language, "English")

        chunks = smart_chunk_text(transcript, max_chars=int(self.summary_chunk_max_chars))
        logger.info(f"分割为 {len(chunks)} 个块进行结构化摘要(JSON)")
        
        per_chunk_keypoints: list[dict] = []
        for i, chunk in enumerate(chunks):
            logger.info(f"正在摘要第 {i+1}/{len(chunks)} 块(提取要点)...")
            system_prompt = SUMMARY_CHUNK_SYSTEM.format(language_name=language_name)
            user_prompt = SUMMARY_CHUNK_USER.format(current_part=i+1, total_parts=len(chunks), text=chunk)
            try:
                kwargs = dict(
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_completion_tokens=int(self.summary_chunk_max_output_tokens),
                    # temperature=0.2,
                )
                if self.use_response_format_json:
                    kwargs["response_format"] = {"type": "json_object"}
                
                chunk_config = None
                if trace_metadata:
                    trace_metadata = trace_metadata or {}
                    chunk_config = {
                         "name": f"Summary Chunk {i+1}",
                         **{k: v for k, v in trace_metadata.items() if k != "metadata"},
                         "metadata": {**trace_metadata.get("metadata", {}), "chunk": i}
                    }

                try:
                    resp = await self._chat_completions_create(models=self.summary_models, trace_config=chunk_config, **kwargs)
                except Exception as e:
                    if self.use_response_format_json and "response_format" in str(e):
                        logger.warning(f"Chunk response_format not supported, retrying without it. Error: {e}")
                        kwargs.pop("response_format", None)
                        resp = await self._chat_completions_create(models=self.summary_models, trace_config=chunk_config, **kwargs)
                    else:
                        raise

                raw = (resp.choices[0].message.content or "").strip()
                json_text = self._extract_first_json_object(raw) or raw
                obj = json.loads(json_text)
                kps = obj.get("keypoints", [])
                if isinstance(kps, list):
                    # Enforce per-chunk cap to keep final integration prompt bounded.
                    kept = 0
                    for kp in kps:
                        if kept >= int(self.summary_max_keypoints_per_chunk):
                            break
                        if isinstance(kp, dict):
                            per_chunk_keypoints.append(kp)
                            kept += 1
            except Exception as e:
                logger.warning(f"Chunk keypoints extraction failed: {e}")
                # Heuristic fallback so we don't lose coverage entirely on a failed chunk.
                per_chunk_keypoints.extend(self._fallback_chunk_keypoints(chunk, target_language)[: int(self.summary_max_keypoints_per_chunk)])
                continue

        # Bound candidates to keep integration prompt stable.
        if len(per_chunk_keypoints) > int(self.summary_max_keypoints_candidates):
            per_chunk_keypoints = per_chunk_keypoints[: int(self.summary_max_keypoints_candidates)]

        # Integrate into final JSON (overview + deduped keypoints)
        system_prompt = SUMMARY_INTEGRATE_SYSTEM.format(
            language_name=language_name,
            target_language=target_language,
            max_keypoints=int(self.summary_max_keypoints_final)
        )
        user_prompt = SUMMARY_INTEGRATE_USER.format(
            keypoints_json=json.dumps(per_chunk_keypoints, ensure_ascii=False)
        )
        integrate_raw = ""
        try:
            kwargs = dict(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=int(self.summary_integrate_max_output_tokens),
                # temperature=0.2,
            )
            if self.use_response_format_json:
                kwargs["response_format"] = {"type": "json_object"}
            try:
                resp = await self._chat_completions_create(models=self.summary_models, **kwargs)
            except Exception as e:
                if self.use_response_format_json and "response_format" in str(e):
                    logger.warning(f"Integrate response_format not supported, retrying without it. Error: {e}")
                    kwargs.pop("response_format", None)
                    resp = await self._chat_completions_create(models=self.summary_models, **kwargs)
                else:
                    raise
            integrate_raw = (resp.choices[0].message.content or "").strip()
            json_text = self._extract_first_json_object(integrate_raw) or integrate_raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Final integration JSON failed. Error: {e}")
            if self.enable_json_repair:
                repaired = await self._repair_summary_json_v1(raw_text=integrate_raw, target_language=target_language)
                if repaired:
                    return repaired
            return self._fallback_summary_json_v1(transcript, target_language)

    def _fallback_chunk_keypoints(self, chunk: str, target_language: str) -> list[dict]:
        """Deterministic fallback: extract 1-2 snippet keypoints from a chunk."""
        cleaned = self._remove_timestamps_and_meta(chunk or "").strip()
        if not cleaned:
            return []
        parts = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]
        if not parts:
            parts = [cleaned]
        out: list[dict] = []
        for p in parts[:2]:
            snippet = p[:320].strip()
            if len(p) > 320:
                snippet += "…"
            out.append(
                {
                    "title": (snippet[:60] + ("…" if len(snippet) > 60 else "")).strip() or "Key Point",
                    "detail": snippet,
                    "evidence": "",
                }
            )
        return out

    async def _repair_summary_json_v1(self, *, raw_text: str, target_language: str) -> Optional[str]:
        """
        Best-effort repair: ask a model to convert arbitrary text into our summary JSON v1 schema.
        Triggered only when the initial JSON parse/validate fails.
        """
        if not self.client:
            return None
        text = (raw_text or "").strip()
        if not text:
            return None
        language_name = self.language_map.get(target_language, "English")
        system_prompt = JSON_REPAIR_SYSTEM.format(language_name=language_name, target_language=target_language)
        user_prompt = JSON_REPAIR_USER.format(text=text)
        try:
            kwargs = dict(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=max(1200, int(self.summary_integrate_max_output_tokens)),
                # temperature=0.1,
            )
            if self.use_response_format_json:
                kwargs["response_format"] = {"type": "json_object"}
            try:
                resp = await self._chat_completions_create(models=[self.json_repair_model], **kwargs)
            except Exception as e:
                if self.use_response_format_json and "response_format" in str(e):
                    kwargs.pop("response_format", None)
                    resp = await self._chat_completions_create(models=[self.json_repair_model], **kwargs)
                else:
                    raise
            repaired_raw = (resp.choices[0].message.content or "").strip()
            repaired_json_text = self._extract_first_json_object(repaired_raw) or repaired_raw
            obj = json.loads(repaired_json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Summary JSON repair failed: {e}")
            return None



    async def _integrate_chunk_summaries(self, combined_summaries: str, target_language: str) -> str:
        """
        整合分块摘要为最终连贯摘要
        """
        language_name = self.language_map.get(target_language, "中文（简体）")
        
        try:
            system_prompt = f"""You are a content integration expert. Please integrate multiple segmented summaries into a complete, coherent summary in {language_name}.

Integration Requirements:
1. Remove duplicate content and maintain clear logic
2. Reorganize content by chronological order
3. Each paragraph must be separated by double line breaks
4. Ensure output is in Markdown format with double line breaks between paragraphs
5. Use concise and clear language
6. Form a complete content summary
7. Cover all parts comprehensively without omission"""

            user_prompt = f"""Please integrate the following segmented summaries into a complete, coherent summary in {language_name}:

{combined_summaries}

Requirements:
- Remove duplicate content and maintain clear logic
- Reorganize content by chronological order
- Each paragraph must be separated by double line breaks
- Ensure output is in Markdown format with double line breaks between paragraphs
- Use concise and clear language
- Form a complete content summary"""

            response = await self._chat_completions_create(
                models=self.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=2500,  # 控制输出规模，兼顾上下文安全
                # temperature=0.3,
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"整合摘要失败: {e}")
            # 失败时直接合并
            return combined_summaries

    def _format_summary_with_meta(self, summary: str, target_language: str, video_title: str = None) -> str:
        """
        为摘要添加标题和元信息
        """
        # 不加任何小标题/免责声明，仅保留视频标题作为一级标题（如果有）
        if video_title:
            return f"# {video_title}\n\n{summary}"
        return summary
    
    def _generate_fallback_summary(self, transcript: str, target_language: str, video_title: str = None) -> str:
        """
        生成备用摘要（当OpenAI API不可用时）
        
        Args:
            transcript: 转录文本
            video_title: 视频标题
            target_language: 目标语言代码
            
        Returns:
            备用摘要文本
        """
        language_name = self.language_map.get(target_language, "中文（简体）")
        
        # 简单的文本处理，提取关键信息
        lines = transcript.split('\n')
        content_lines = [line for line in lines if line.strip() and not line.startswith('#') and not line.startswith('**')]
        
        # 计算大概的长度
        total_chars = sum(len(line) for line in content_lines)
        
        # 使用目标语言的标签
        meta_labels = self._get_summary_labels(target_language)
        fallback_labels = self._get_fallback_labels(target_language)
        
        # 直接使用视频标题作为主标题  
        title = video_title if video_title else "Summary"
        
        summary = f"""# {title}

**{meta_labels['language_label']}:** {language_name}
**{fallback_labels['notice']}:** {fallback_labels['api_unavailable']}



## {fallback_labels['overview_title']}

**{fallback_labels['content_length']}:** {fallback_labels['about']} {total_chars} {fallback_labels['characters']}
**{fallback_labels['paragraph_count']}:** {len(content_lines)} {fallback_labels['paragraphs']}

## {fallback_labels['main_content']}

{fallback_labels['content_description']}

{fallback_labels['suggestions_intro']}

1. {fallback_labels['suggestion_1']}
2. {fallback_labels['suggestion_2']}
3. {fallback_labels['suggestion_3']}

## {fallback_labels['recommendations']}

- {fallback_labels['recommendation_1']}
- {fallback_labels['recommendation_2']}


<br/>

<p style="color: #888; font-style: italic; text-align: center; margin-top: 16px;"><em>{fallback_labels['fallback_disclaimer']}</em></p>"""
        
        return summary
    
    def _get_current_time(self) -> str:
        """获取当前时间字符串"""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def get_supported_languages(self) -> dict:
        """
        获取支持的语言列表
        
        Returns:
            语言代码到语言名称的映射
        """
        return self.language_map.copy()
    
  # 默认英文
    
    def _get_language_instruction(self, lang_code: str) -> str:
        """
        根据语言代码获取优化指令中使用的语言名称
        
        Args:
            lang_code: 语言代码
            
        Returns:
            语言名称
        """
        language_instructions = {
            "en": "English",
            "zh": "中文",
            "ja": "日本語",
            "ko": "한국어",
            "es": "Español",
            "fr": "Français",
            "de": "Deutsch",
            "it": "Italiano",
            "pt": "Português",
            "ru": "Русский",
            "ar": "العربية"
        }
        return language_instructions.get(lang_code, "English")
    

    def _get_summary_labels(self, lang_code: str) -> dict:
        """
        获取摘要页面的多语言标签
        
        Args:
            lang_code: 语言代码
            
        Returns:
            标签字典
        """
        labels = {
            "en": {
                "language_label": "Summary Language",
                "disclaimer": "This summary is automatically generated by AI for reference only"
            },
            "zh": {
                "language_label": "摘要语言",
                "disclaimer": "本摘要由AI自动生成，仅供参考"
            },
            "ja": {
                "language_label": "要約言語",
                "disclaimer": "この要約はAIによって自動生成されており、参考用です"
            },
            "ko": {
                "language_label": "요약 언어",
                "disclaimer": "이 요약은 AI에 의해 자동 생성되었으며 참고용입니다"
            },
            "es": {
                "language_label": "Idioma del Resumen",
                "disclaimer": "Este resumen es generado automáticamente por IA, solo para referencia"
            },
            "fr": {
                "language_label": "Langue du Résumé",
                "disclaimer": "Ce résumé est généré automatiquement par IA, à titre de référence uniquement"
            },
            "de": {
                "language_label": "Zusammenfassungssprache",
                "disclaimer": "Diese Zusammenfassung wird automatisch von KI generiert, nur zur Referenz"
            },
            "it": {
                "language_label": "Lingua del Riassunto",
                "disclaimer": "Questo riassunto è generato automaticamente dall'IA, solo per riferimento"
            },
            "pt": {
                "language_label": "Idioma do Resumo",
                "disclaimer": "Este resumo é gerado automaticamente por IA, apenas para referência"
            },
            "ru": {
                "language_label": "Язык резюме",
                "disclaimer": "Это резюме автоматически генерируется ИИ, только для справки"
            },
            "ar": {
                "language_label": "لغة الملخص",
                "disclaimer": "هذا الملخص تم إنشاؤه تلقائياً بواسطة الذكاء الاصطناعي، للمرجع فقط"
            }
        }
        return labels.get(lang_code, labels["en"])
    
    def _get_fallback_labels(self, lang_code: str) -> dict:
        """
        获取备用摘要的多语言标签
        
        Args:
            lang_code: 语言代码
            
        Returns:
            标签字典
        """
        labels = {
            "en": {
                "notice": "Notice",
                "api_unavailable": "OpenAI API is unavailable, this is a simplified summary",
                "overview_title": "Transcript Overview",
                "content_length": "Content Length",
                "about": "About",
                "characters": "characters",
                "paragraph_count": "Paragraph Count",
                "paragraphs": "paragraphs",
                "main_content": "Main Content",
                "content_description": "The transcript contains complete video speech content. Since AI summary cannot be generated currently, we recommend:",
                "suggestions_intro": "For detailed information, we suggest you:",
                "suggestion_1": "Review the complete transcript text for detailed information",
                "suggestion_2": "Focus on important paragraphs marked with timestamps",
                "suggestion_3": "Manually extract key points and takeaways",
                "recommendations": "Recommendations",
                "recommendation_1": "Configure OpenAI API key for better summary functionality",
                "recommendation_2": "Or use other AI services for text summarization",
                "fallback_disclaimer": "This is an automatically generated fallback summary"
            },
            "zh": {
                "notice": "注意",
                "api_unavailable": "由于OpenAI API不可用，这是一个简化的摘要",
                "overview_title": "转录概览",
                "content_length": "内容长度",
                "about": "约",
                "characters": "字符",
                "paragraph_count": "段落数量",
                "paragraphs": "段",
                "main_content": "主要内容",
                "content_description": "转录文本包含了完整的视频语音内容。由于当前无法生成智能摘要，建议您：",
                "suggestions_intro": "为获取详细信息，建议您：",
                "suggestion_1": "查看完整的转录文本以获取详细信息",
                "suggestion_2": "关注时间戳标记的重要段落",
                "suggestion_3": "手动提取关键观点和要点",
                "recommendations": "建议",
                "recommendation_1": "配置OpenAI API密钥以获得更好的摘要功能",
                "recommendation_2": "或者使用其他AI服务进行文本总结",
                "fallback_disclaimer": "本摘要为自动生成的备用版本"
            }
        }
        return labels.get(lang_code, labels["en"])
    
    def is_available(self) -> bool:
        """
        检查摘要服务是否可用
        
        Returns:
            True if OpenAI API is configured, False otherwise
        """
        return self.client is not None
