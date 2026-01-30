"""
Backward-compatible re-exports from summarizer package.

This module maintains backward compatibility for existing imports like:
    from services.summarizer import Summarizer
    from services.summarizer import ContentClassification
"""
from services.summarizer import (
    Summarizer,
    ContentClassification,
    KeyPoint,
    ActionItem,
    Risk,
    SummaryResponse,
)

__all__ = [
    "Summarizer",
    "ContentClassification",
    "KeyPoint",
    "ActionItem",
    "Risk",
    "SummaryResponse",
]
