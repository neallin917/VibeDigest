"""
Core summary generation engine.

This module handles the main summarization logic including single-text
summaries, chunked summaries, and V2 classified summaries.
"""
import json
import logging
import re
from typing import Any, Dict, List, Optional

from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from prompts import (
    SUMMARY_SINGLE_SYSTEM,
    SUMMARY_SINGLE_USER,
    SUMMARY_CHUNK_SYSTEM,
    SUMMARY_CHUNK_USER,
    SUMMARY_INTEGRATE_SYSTEM,
    SUMMARY_INTEGRATE_USER,
    SUMMARY_V2_USER_TEMPLATE,
)
from services.summarizer.models import SummaryResponse
from services.summarizer.config import supports_structured_output, get_llm
from utils.text_utils import (
    extract_first_json_object,
    remove_timestamps_and_meta,
)
from utils.language_utils import normalize_lang_code
from utils.openai_client import ainvoke_structured_json

logger = logging.getLogger(__name__)


class SummaryEngine:
    """
    Core engine for generating summaries.

    Handles both single-text and chunked summarization with support
    for V2 classification-based dynamic prompts.
    """

    def __init__(
        self,
        config: Any,
        invoke_with_fallback: Any,
        text_processor: Any,
        classifier: Any,
    ):
        """
        Initialize the SummaryEngine.

        Args:
            config: SummarizerConfig instance
            invoke_with_fallback: Async function for LLM invocation with fallback
            text_processor: TextProcessor instance for chunking
            classifier: ContentClassifier instance
        """
        self.config = config
        self._ainvoke_with_fallback = invoke_with_fallback
        self.text_processor = text_processor
        self.classifier = classifier

    async def summarize(
        self,
        transcript: str,
        target_language: str = "zh",
        video_title: Optional[str] = None,
        existing_classification: Optional[Dict[str, Any]] = None,
        trace_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Generate a summary of the transcript.

        Args:
            transcript: The transcript text to summarize
            target_language: Target language code
            video_title: Optional video title
            existing_classification: Optional pre-computed classification
            trace_metadata: Optional tracing metadata

        Returns:
            JSON string containing the summary
        """
        try:
            if not self.config.api_key:
                logger.warning("OpenAI API unavailable, summary generation skipped")
                if self.config.enable_summary_fallback:
                    fallback_language = normalize_lang_code(target_language)
                    return self._fallback_summary_json_v1(
                        transcript, fallback_language
                    )
                raise RuntimeError("OpenAI API unavailable for summary generation")

            target_language = normalize_lang_code(target_language)

            if settings.SUMMARY_STRATEGY == "v2_classified":
                logger.info("Using V2 classified summary strategy")
                return await self._summarize_v2_classified(
                    transcript,
                    target_language,
                    existing_classification=existing_classification,
                    trace_metadata=trace_metadata,
                )

            estimated_tokens = self.text_processor.estimate_tokens(transcript)
            max_summarize_tokens = int(self.config.summary_single_max_est_tokens)

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
            if self.config.enable_summary_fallback:
                try:
                    fallback_language = normalize_lang_code(target_language)
                    logger.warning(
                        "Falling back to heuristic summary JSON after failure"
                    )
                    return self._fallback_summary_json_v1(
                        transcript, fallback_language
                    )
                except Exception as fallback_error:
                    logger.error(
                        f"Fallback summary generation failed: {fallback_error}"
                    )
            raise

    async def _summarize_v2_classified(
        self,
        transcript: str,
        target_language: str,
        existing_classification: Optional[Dict[str, Any]] = None,
        trace_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate summary using V2 classification-based approach."""
        language_name = self.config.language_map.get(target_language, "English")
        if existing_classification:
            classification = existing_classification
            logger.info(f"Using existing classification: {classification}")
        else:
            classification = await self.classifier.classify_content(
                transcript, trace_metadata=trace_metadata
            )

        if not classification:
            classification = {
                "content_form": "casual",
                "info_structure": "thematic",
                "cognitive_goal": "digest",
                "confidence": 0.0,
            }

        system_prompt = self.classifier.build_v2_dynamic_prompt(
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
            last_exception = None
            for model in self.config.summary_models:
                try:
                    llm = get_llm(
                        model, max_tokens=self.config.summary_single_max_output_tokens
                    )
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

                    if self.config.use_response_format_json or not supports_structured_output(
                        model
                    ):
                        raw = await llm.ainvoke(messages, config=lc_config)
                        raw_text = getattr(raw, "content", None) or str(raw)
                        json_text = extract_first_json_object(raw_text) or raw_text
                        obj = json.loads(json_text)
                        summary_obj = SummaryResponse(**obj)
                        if hasattr(summary_obj, "model_dump"):
                            obj = summary_obj.model_dump()
                        else:
                            obj = summary_obj.dict()
                    else:
                        obj = await ainvoke_structured_json(
                            llm,
                            SummaryResponse,
                            messages,
                            config=lc_config,
                        )

                    if not isinstance(obj, dict):
                        raise ValueError("Structured summary payload is not a dict")
                    if "content_type" in obj:
                        obj["content_type"] = classification

                    # Force language to match target_language
                    obj["language"] = target_language

                    return json.dumps(obj, ensure_ascii=False)
                except Exception as e:
                    last_exception = e
                    logger.warning(f"Summarize V2 with model {model} failed: {e}")
                    continue

            if self.config.enable_summary_fallback:
                return self._fallback_summary_json_v1(transcript, target_language)
            raise last_exception or Exception("All models failed for Summarize V2")
        except Exception as e:
            logger.error(f"Summarize V2 failed: {e}")
            if self.config.enable_summary_fallback:
                return self._fallback_summary_json_v1(transcript, target_language)
            raise

    async def _summarize_single_text_json(
        self, transcript: str, target_language: str, trace_metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate summary for a single text (fits in context window)."""
        language_name = self.config.language_map.get(target_language, "English")
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

        raw = ""
        try:
            response = await self._ainvoke_with_fallback(
                models=self.config.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=int(self.config.summary_single_max_output_tokens),
                trace_config=trace_config,
                response_format={"type": "json_object"} if settings.USE_JSON_MODE else None,
            )
            raw = (response.content or "").strip()
            json_text = extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Summary JSON failed: {e}")
            if self.config.enable_json_repair:
                try:
                    repaired = await self._repair_summary_json_v1(
                        raw_text=raw, target_language=target_language
                    )
                    if repaired:
                        return repaired
                except Exception:
                    pass
            if self.config.enable_summary_fallback:
                return self._fallback_summary_json_v1(transcript, target_language)
            raise

    async def _summarize_with_chunks_json(
        self,
        transcript: str,
        target_language: str,
        max_summarize_tokens: int,
        trace_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate summary by processing in chunks."""
        chunks = self.text_processor.split_into_chunks(transcript, max_summarize_tokens)
        logger.info(f"Split into {len(chunks)} chunks for summarization")

        chunk_summaries = []
        language_name = self.config.language_map.get(target_language, "English")

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
                    models=self.config.summary_models,
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
            if self.config.enable_summary_fallback:
                return self._fallback_summary_json_v1(transcript, target_language)
            raise RuntimeError("Chunk summary failed for all chunks")

        return await self._integrate_chunk_summaries(
            valid_summaries, target_language, trace_metadata=trace_metadata
        )

    async def _integrate_chunk_summaries(
        self,
        chunk_summaries: List[str],
        target_language: str,
        trace_metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Integrate multiple chunk summaries into a final summary."""
        combined = "\n\n".join(chunk_summaries)
        language_name = self.config.language_map.get(target_language, "English")

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

        raw = ""
        try:
            response = await self._ainvoke_with_fallback(
                models=self.config.summary_models,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_completion_tokens=int(self.config.summary_integrate_max_output_tokens),
                trace_config=trace_config,
                response_format={"type": "json_object"} if settings.USE_JSON_MODE else None,
            )
            raw = (response.content or "").strip()
            json_text = extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Integration failed: {e}")
            if self.config.enable_json_repair:
                try:
                    repaired = await self._repair_summary_json_v1(
                        raw_text=raw, target_language=target_language
                    )
                    if repaired:
                        return repaired
                except Exception:
                    pass
            if self.config.enable_summary_fallback:
                return self._fallback_summary_json_v1(combined, target_language)
            raise

    async def _repair_summary_json_v1(
        self, raw_text: str, target_language: str
    ) -> Optional[str]:
        """Attempt to repair invalid JSON using LLM."""
        prompt = f"The following JSON is invalid. Please fix it and return ONLY the valid JSON.\n\n{raw_text[:3000]}"
        try:
            response = await self._ainvoke_with_fallback(
                models=[self.config.json_repair_model],
                messages=[{"role": "user", "content": prompt}],
                max_completion_tokens=2000,
                response_format={"type": "json_object"} if settings.USE_JSON_MODE else None,
            )
            raw = (response.content or "").strip()
            json_text = extract_first_json_object(raw) or raw
            obj = json.loads(json_text)
            obj = self._validate_summary_json_v1(obj, target_language)
            return json.dumps(obj, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"JSON repair failed: {e}")
            return None

    def _validate_summary_json_v1(self, obj: Dict[str, Any], target_language: str) -> Dict[str, Any]:
        """Validate and normalize summary JSON structure."""
        if not isinstance(obj, dict):
            raise ValueError("Summary JSON must be an object")
        version = int(obj.get("version", 2))
        language = target_language
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
                out: Dict[str, Any] = {
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

    def _fallback_summary_json_v1(self, transcript: str, target_language: str) -> str:
        """Generate a basic fallback summary without LLM."""
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
