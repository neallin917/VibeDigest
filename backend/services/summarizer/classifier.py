"""
Content classification module.

This module handles content type classification using LLM-based analysis
to determine content form, information structure, and cognitive goal.
"""
import json
import logging
from typing import Any, Dict, Optional

from langchain_core.messages import SystemMessage, HumanMessage

from config import settings
from prompts import (
    CONTENT_CLASSIFIER_SYSTEM,
    CONTENT_CLASSIFIER_USER,
    STRUCTURE_TEMPLATES,
    GOAL_TEMPLATES,
    FORM_SUPPLEMENTS,
    SUMMARY_V2_SYSTEM_TEMPLATE,
)
from services.summarizer.models import ContentClassification
from services.summarizer.config import supports_structured_output, get_llm
from utils.text_utils import extract_first_json_object
from utils.openai_client import ainvoke_structured_json

logger = logging.getLogger(__name__)

# Valid classification values
VALID_FORMS = {
    "tutorial",
    "interview",
    "monologue",
    "news",
    "review",
    "finance",
    "narrative",
    "casual",
}
VALID_STRUCTURES = {
    "hierarchical",
    "sequential",
    "argumentative",
    "comparative",
    "narrative_arc",
    "thematic",
    "qa_format",
    "data_driven",
}
VALID_GOALS = {"understand", "decide", "execute", "inspire", "digest"}


class ContentClassifier:
    """
    Classifies content to determine optimal summarization strategy.

    Uses LLM to analyze content and classify it by:
    - content_form: The style/format of the content
    - info_structure: How information is organized
    - cognitive_goal: What the reader should gain
    """

    def __init__(self, config: Any):
        """
        Initialize the ContentClassifier.

        Args:
            config: SummarizerConfig instance
        """
        self.config = config

    async def classify_content(
        self, transcript: str, trace_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Classify content to determine summarization strategy.

        Args:
            transcript: The transcript text to classify
            trace_metadata: Optional tracing metadata

        Returns:
            Classification dict with content_form, info_structure, cognitive_goal, confidence
        """
        transcript_sample = transcript[:15000]
        system_prompt = CONTENT_CLASSIFIER_SYSTEM
        user_prompt = CONTENT_CLASSIFIER_USER.format(
            transcript_sample=transcript_sample
        )

        async def _classify_with_model(model_name: str) -> Dict[str, Any]:
            trace_config = None
            if trace_metadata:
                trace_config = {
                    "name": "Content Classification",
                    "metadata": {**trace_metadata.get("metadata", {})},
                    **{k: v for k, v in trace_metadata.items() if k != "metadata"},
                }

            llm = get_llm(model_name, max_tokens=settings.SHORT_TASK_MAX_TOKENS)

            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            lc_config = {
                "run_name": trace_config.get("name", "Content Classification")
                if trace_config
                else "Content Classification",
                "metadata": trace_config.get("metadata", {}) if trace_config else {},
            }

            if self.config.use_response_format_json or not supports_structured_output(
                model_name
            ):
                raw = await llm.ainvoke(messages, config=lc_config)
                raw_text = getattr(raw, "content", None) or str(raw)
                json_text = extract_first_json_object(raw_text) or raw_text
                obj = json.loads(json_text)
                classification_obj = ContentClassification(**obj)
                if hasattr(classification_obj, "model_dump"):
                    classification_data = classification_obj.model_dump()
                else:
                    classification_data = classification_obj.dict()
            else:
                classification_data = await ainvoke_structured_json(
                    llm,
                    ContentClassification,
                    messages,
                    config=lc_config,
                )

            return classification_data

        try:
            classification_data = await _classify_with_model(self.config.classifier_model)
        except Exception as e:
            fallback_model = settings.OPENAI_HELPER_MODEL
            if fallback_model and fallback_model != self.config.classifier_model:
                logger.warning(
                    "Classification failed with %s, retrying with %s: %s",
                    self.config.classifier_model,
                    fallback_model,
                    e,
                )
                try:
                    classification_data = await _classify_with_model(fallback_model)
                except Exception as fallback_e:
                    logger.error(
                        "Classification fallback also failed: %s. Returning defaults.",
                        fallback_e,
                    )
                    return self._default_classification()
            else:
                logger.error(
                    "Classification failed and no fallback available: %s. Returning defaults.",
                    e,
                )
                return self._default_classification()

        # Normalize and validate
        result = {
            "content_form": classification_data.get("content_form"),
            "info_structure": classification_data.get("info_structure"),
            "cognitive_goal": classification_data.get("cognitive_goal"),
            "confidence": classification_data.get("confidence", 0.0),
        }

        if result["content_form"] not in VALID_FORMS:
            result["content_form"] = "casual"
        if result["info_structure"] not in VALID_STRUCTURES:
            result["info_structure"] = "thematic"
        if result["cognitive_goal"] not in VALID_GOALS:
            result["cognitive_goal"] = "digest"

        logger.info(f"Classification result (Structured): {result}")
        return result

    def build_v2_dynamic_prompt(
        self, classification: Dict[str, Any], language_name: str, target_language: str
    ) -> str:
        """
        Build a dynamic system prompt based on content classification.

        Args:
            classification: Content classification dict
            language_name: Human-readable language name
            target_language: Target language code

        Returns:
            System prompt string for V2 summarization
        """
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

    @staticmethod
    def _default_classification() -> Dict[str, Any]:
        """Return default classification values."""
        return {
            "content_form": "casual",
            "info_structure": "thematic",
            "cognitive_goal": "digest",
            "confidence": 0.0,
        }
