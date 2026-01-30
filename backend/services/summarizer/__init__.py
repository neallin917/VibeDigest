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
    ActionItem,
    Risk,
    SummaryResponse,
)
from services.summarizer.facade import Summarizer

__all__ = [
    "Summarizer",
    "ContentClassification",
    "KeyPoint",
    "ActionItem",
    "Risk",
    "SummaryResponse",
]
