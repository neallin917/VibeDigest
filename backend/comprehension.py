import json
import os
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from config import settings
from langchain_core.messages import SystemMessage, HumanMessage

from prompts import COMPREHENSION_BRIEF_SYSTEM, COMPREHENSION_BRIEF_USER
from utils.text_utils import get_language_name

logger = logging.getLogger(__name__)

class InsightItem(BaseModel):
    title: str = Field(..., description="Crisp insight headline")
    new_perspective: str = Field(..., description="What new perspective this adds. Can use newlines (\\n) for structured explanation.")
    why_it_matters: str = Field(..., description="Exactly why this changes how the user thinks (1-2 lines)")

class TargetAudience(BaseModel):
    who_benefits: List[str] = Field(..., min_length=1, description="List of people who specifically benefit from this content")
    who_wont: List[str] = Field(..., min_length=1, description="List of people who this is NOT for")

class ComprehensionBriefResponse(BaseModel):
    core_intent: str = Field(..., description="WHAT THIS IS REALLY ABOUT: 1 sentence state the core problem / intent, not topics. Can use newlines (\\n) for logical grouping.")
    core_position: str = Field(..., description="SPEAKER’S CORE POSITION: 1 sentence judgment or stance worth remembering. Can use newlines (\\n) for emphasis.")
    key_insights: List[InsightItem] = Field(..., min_length=3, max_length=5, description="KEY INSIGHTS: 3–5 items adding new perspective.")
    what_to_ignore: List[str] = Field(..., min_length=1, description="WHAT CAN BE IGNORED: List of low-signal sections, PR, filler, repetition.")
    target_audience: TargetAudience = Field(..., description="WHO THIS IS FOR / NOT FOR")
    reusable_takeaway: str = Field(..., description="REUSABLE TAKEAWAY: One transferable output (framework/checklist/etc). Support multiple lines (\\n) for better readability.")

class ComprehensionAgent:
    """Comprehension Agent: Focuses on deep understanding and user absorption."""

    def __init__(self):
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        # Higher-level reasoning models prioritized for deep comprehension (Learning Tab)
        self.comprehension_models = settings.OPENAI_COMPREHENSION_MODELS

    def _get_llm(self, model_name: str, max_tokens: int = None):
        from utils.openai_client import create_chat_model
        
        # Use centralized default if max_tokens not provided
        tokens = max_tokens or settings.DEFAULT_MAX_TOKENS
        
        return create_chat_model(
            model_name=model_name,
            # temperature handled by factory
            max_tokens=tokens
        )

    async def generate_comprehension_brief(
        self, 
        transcript: str, 
        target_language: str = "zh",
        trace_config: Optional[dict] = None
    ) -> str:
        """Generates a structured comprehension brief focusing on absorption."""
        # Significantly expanded to 200k chars (~50k-100k tokens) 
        # to leverage high-end models' long context reasoning window.
        max_chars = 200000 
        if len(transcript) > max_chars:
            # If still too long, we take the beginning and ending to preserve context.
            logger.info(f"Transcript too long ({len(transcript)} chars), using tail-head truncation.")
            half = max_chars // 2
            transcript = transcript[:half] + "\n... [Intermediate content skipped to preserve reasoning over start and end] ...\n" + transcript[-half:]

        # Get the descriptive language name based on project-wide LANGUAGE_MAP
        language_name = get_language_name(target_language)
        
        system_prompt = COMPREHENSION_BRIEF_SYSTEM.format(language_name=language_name)
        user_prompt = COMPREHENSION_BRIEF_USER.format(transcript=transcript, language_name=language_name)

        last_exception = None
        for model in self.comprehension_models:
            try:
                llm = self._get_llm(model)
                structured_llm = llm.with_structured_output(ComprehensionBriefResponse)
                
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                lc_config = {}
                if trace_config:
                    lc_config = {
                        "run_name": trace_config.get("name"),
                        "metadata": trace_config.get("metadata", {}),
                        **{k: v for k, v in trace_config.items() if k not in ["name", "metadata"]}
                    }

                brief_obj: ComprehensionBriefResponse = await structured_llm.ainvoke(messages, config=lc_config)
                return brief_obj.model_dump_json()
            except Exception as e:
                last_exception = e
                logger.warning(f"Comprehension Brief with model {model} failed: {e}")
                continue
        
        try:
            raise last_exception or Exception("All models failed for Comprehension Brief")
        except Exception as e:
            logger.error(f"Comprehension Brief failed: {e}")
            return json.dumps({
                "core_intent": "Failed to generate core intent.",
                "core_position": "Failed to generate speaker's position.",
                "key_insights": [],
                "what_to_ignore": [],
                "target_audience": {
                    "who_benefits": [],
                    "who_wont": []
                },
                "reusable_takeaway": "Failed to generate takeaway."
            }, ensure_ascii=False)
