import logging
from typing import Optional, Dict
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from utils.text_utils import extract_pure_text, count_words_or_units

logger = logging.getLogger(__name__)

class TranscriptValidation(BaseModel):
    is_valid: bool = Field(description="Whether the transcript is reasonably relevant to the video title and not a placeholder.")
    reason: str = Field(description="Brief reason for the validation result.")

class TranscriptGuard:
    """
    AI-powered guard to validate transcripts and detect poor quality or placeholder content.
    """
    
    def __init__(self, model_name: str = "gpt-4o-mini"):
        self.model_name = model_name
        self._llm: Optional[ChatOpenAI] = None

    def _get_llm(self):
        if self._llm is None:
            self._llm = ChatOpenAI(model=self.model_name, temperature=0)
        return self._llm

    async def validate(
        self, 
        transcript: str, 
        video_title: str, 
        video_duration: Optional[float] = None,
        trace_metadata: Optional[Dict] = None
    ) -> bool:
        """
        Validate transcript quality using heuristics and AI.
        Returns True if valid, False if it should be rejected.
        """
        if not transcript:
            return False

        # 1. Heuristic Check: Duration vs Text Length
        # If we have duration, we can check if the transcript is suspiciously short or long for the video.
        # But even without duration, we can check absolute length.
        pure_text = extract_pure_text(transcript)
        word_count = count_words_or_units(pure_text)
        
        if word_count < 20:
            logger.warning(f"Transcript too short ({word_count} words). Rejecting.")
            return False

        if video_duration and video_duration > 60: # If video > 1 min
             # If transcript covers < 5% of video duration (roughly)
             # This is hard to estimate precisely without segment details, 
             # but we can detect if Supadata returned a single 0.1s segment.
             pass

        # 2. AI Semantic Check
        # Sample the transcript (beginning, middle, end) if it's long
        sample_size = 1500
        if len(pure_text) > sample_size * 2:
            sample = f"{pure_text[:sample_size]}\n... [Content Cut] ...\n{pure_text[-sample_size:]}"
        else:
            sample = pure_text

        system_prompt = (
            "You are a transcript quality guard. Your goal is to detect if a transcript is "
            "a generic placeholder, a technical introduction (like NLP intro), or completely "
            "irrelevant to the video title.\n\n"
            "Respond with 'is_valid' as false if:\n"
            "1. The content describes a generic concept (e.g. 'What is NLP') but the title is specific (e.g. 'Claude SDK Workshop').\n"
            "2. The content looks like an AI-generated template or a system error message.\n"
            "3. The content is extremely generic and lacks any specific details from the title."
        )
        
        user_prompt = f"Video Title: {video_title}\n\nTranscript Sample:\n{sample}"

        try:
            llm = self._get_llm()
            structured_llm = llm.with_structured_output(TranscriptValidation)
            
            result = await structured_llm.ainvoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            
            if not result.is_valid:
                logger.warning(f"AI Guard rejected transcript: {result.reason}")
                return False
            
            logger.info("AI Guard validated transcript successfully.")
            return True
            
        except Exception as e:
            logger.error(f"AI Guard validation failed (error): {e}. Defaulting to True to avoid blocking.")
            # Fallback to True if AI check fails, unless it's obviously bad
            return True
