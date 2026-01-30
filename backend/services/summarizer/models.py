"""
Pydantic models for the Summarizer service.

These models define the structured output schemas for content classification
and summary generation.
"""
from typing import List, Optional

from pydantic import BaseModel, Field


class ContentClassification(BaseModel):
    """Classification of content type, structure, and cognitive goal."""

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
    confidence: float = Field(default=0.0, description="Confidence score between 0.0 and 1.0")


class KeyPoint(BaseModel):
    """A key point extracted from content."""

    title: str = Field(..., description="Concise title of the key point")
    detail: str = Field(..., description="Detailed explanation of the key point")
    evidence: str = Field(
        ..., description="Exact quote or evidence from the text properly attributed"
    )


class ActionItem(BaseModel):
    """An actionable item or next step from the content."""

    content: str = Field(..., description="The action item or next step")
    priority: str = Field(
        default="medium", description="Priority level: high, medium, or low"
    )


class Risk(BaseModel):
    """A risk or warning mentioned in the content."""

    content: str = Field(..., description="The risk or warning description")
    severity: str = Field(
        default="medium", description="Severity level: high, medium, or low"
    )


class SummaryResponse(BaseModel):
    """Complete structured summary response."""

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
