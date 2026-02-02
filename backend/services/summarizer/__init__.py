"""
Summarizer package for text summarization and content classification.

This package provides:
- Content classification (form, structure, goal)
- Multi-language summary generation
- Transcript optimization
- Timestamp-based keypoint matching
- Summary translation
"""
from services.summarizer.models import (
    ContentClassification,
    KeyPoint,
    KeyQuote,
    Insight,
    ActionItem,
    Risk,
    ContentContext,
    SummaryResponse,
    SectionItem,
    DynamicSection,
    ContentPlan,
    SummaryResponseV4,
)
from services.summarizer.facade import Summarizer

__all__ = [
    "Summarizer",
    "ContentClassification",
    "KeyPoint",
    "KeyQuote",
    "Insight",
    "ActionItem",
    "Risk",
    "ContentContext",
    "SummaryResponse",
    "SectionItem",
    "DynamicSection",
    "ContentPlan",
    "SummaryResponseV4",
]
