"""
Language detection and utility functions.

This module consolidates language-related utilities used across the application.
It has ZERO internal dependencies to avoid circular imports.
"""
from typing import Optional

# Canonical language map for display names
LANGUAGE_MAP = {
    "en": "English",
    "zh": "中文（简体）",
    "zh-cn": "中文（简体）",
    "zh-tw": "中文（繁体）",
    "chinese": "中文（简体）",
    "es": "Español",
    "fr": "Français",
    "de": "Deutsch",
    "it": "Italiano",
    "pt": "Português",
    "ru": "Русский",
    "ja": "日本語",
    "japanese": "日本語",
    "ko": "한국어",
    "korean": "한국어",
    "ar": "العربية",
    "hi": "हिन्दी",
}


def is_cjk_language(lang: str) -> bool:
    """
    Best-effort check for CJK-like languages where whitespace is sparse.

    Args:
        lang: Language code or name (e.g., 'zh', 'chinese', 'ja', 'japanese')

    Returns:
        True if the language is Chinese, Japanese, or Korean
    """
    if not lang:
        return False
    s = str(lang).lower()
    return any(k in s for k in ("zh", "chinese", "ja", "japanese", "ko", "korean"))


def get_language_name(code: str) -> str:
    """
    Get the display name for a language code, or return the code itself.

    Args:
        code: Language code (e.g., 'en', 'zh', 'ja')

    Returns:
        Human-readable language name
    """
    if not code:
        return "English"
    return LANGUAGE_MAP.get(code.lower(), code)


def normalize_lang_code(lang: Optional[str]) -> str:
    """
    Normalize a language code to a standard form.

    Handles full language names (e.g., 'chinese' -> 'zh'),
    variant codes (e.g., 'zh-CN' -> 'zh'), and unknown values.

    Args:
        lang: Language code or name to normalize

    Returns:
        Normalized language code (e.g., 'zh', 'en', 'ja')
    """
    if not lang:
        return "unknown"
    s = str(lang).strip().lower()

    # Map full names to codes
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

    # Normalize separators
    s = s.replace("_", "-")
    if not s:
        return "unknown"

    # Handle Chinese variants (zh-CN, zh-TW -> zh)
    if s.startswith("zh-"):
        return "zh"

    # Return base code (e.g., 'en-US' -> 'en')
    return s.split("-")[0] or "unknown"
