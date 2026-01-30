import re

# Re-export from env_utils for backward compatibility
from utils.env_utils import parse_bool_env  # noqa: F401

# Re-export from language_utils for backward compatibility
from utils.language_utils import (  # noqa: F401
    LANGUAGE_MAP,
    is_cjk_language,
    get_language_name,
    normalize_lang_code,
)

# Common patterns to avoid treating "." as sentence-ending for URLs/abbrevs/extensions.
COMMON_TLDS = {
    "com", "org", "net", "edu", "gov", "co", "io", "ai", "dev",
    "txt", "pdf", "jpg", "png", "gif", "doc", "zip", "html", "js", "ts"
}
COMMON_ABBREVS = {"dr", "mr", "mrs", "ms", "vs", "etc", "inc", "ltd", "jr", "sr"}

SENTENCE_PUNCTUATION_REGEX = re.compile(r"[.!?\u3002\uff01\uff1f\u203c\u2047\u2048]")
WHITESPACE_GLOBAL_REGEX = re.compile(r"\s+")
PUNCTUATION_OR_SPACE_REGEX = re.compile(r"[\s,;!?]")
DIGIT_REGEX = re.compile(r"\d")
NON_PERIOD_SENTENCE_ENDING_REGEX = re.compile(r"[!?\u3002\uff01\uff1f\u203c\u2047\u2048]$")

def count_words_or_units(text: str) -> int:
    """
    Count "units" for length bounding.
    - If text has spaces, count words.
    - Otherwise (e.g. CJK without spaces), approximate by counting non-space characters.
    """
    if not text:
        return 0
    s = text.strip()
    if not s:
        return 0
    if " " in s or "\t" in s or "\n" in s:
        return len([w for w in re.split(r"\s+", s) if w])
    # No spaces -> likely CJK; count visible chars as rough units
    return len([ch for ch in s if not ch.isspace()])

def is_sentence_ending_period(text: str, period_index: int) -> bool:
    before = text[period_index - 1] if period_index - 1 >= 0 else ""
    after = text[period_index + 1] if period_index + 1 < len(text) else ""

    # Decimal number: digit before and digit after (e.g., "2.2", "3.14")
    if before and after and DIGIT_REGEX.search(before) and DIGIT_REGEX.search(after):
        return False

    # Check for common TLDs and file extensions (e.g., ".com", ".org", ".txt")
    after_period = text[period_index + 1: period_index + 5].lower()
    for pattern in COMMON_TLDS:
        if after_period.startswith(pattern):
            char_after_pattern = text[period_index + 1 + len(pattern): period_index + 2 + len(pattern)]
            if not char_after_pattern or PUNCTUATION_OR_SPACE_REGEX.search(char_after_pattern):
                return False

    # Common abbreviations (check 1-3 chars before period)
    before_period = text[max(0, period_index - 3): period_index].lower()
    for abbrev in COMMON_ABBREVS:
        if before_period.endswith(abbrev):
            return False

    return True

def ends_with_sentence(text: str) -> bool:
    trimmed = (text or "").strip()
    if not trimmed:
        return False

    # Non-period sentence endings
    if NON_PERIOD_SENTENCE_ENDING_REGEX.search(trimmed):
        return True

    # Period - verify it's truly sentence-ending
    if trimmed.endswith("."):
        return is_sentence_ending_period(trimmed, len(trimmed) - 1)

    return False

def find_true_sentence_punct_positions(text: str) -> list[int]:
    """Return indices of punctuation that are truly sentence-ending."""
    trimmed = (text or "").strip()
    if not trimmed:
        return []
    positions: list[int] = []
    for m in SENTENCE_PUNCTUATION_REGEX.finditer(trimmed):
        idx = m.start()
        ch = trimmed[idx]
        if ch != ".":
            positions.append(idx)
        else:
            if is_sentence_ending_period(trimmed, idx):
                positions.append(idx)
    return positions

def find_early_punctuation_split(text: str) -> int:
    """
    Find sentence-ending punctuation near the beginning of text (within first 2 words/units).
    Returns the index position right after the punctuation, or -1 if none found.
    """
    trimmed = (text or "").strip()
    if not trimmed:
        return -1
    positions = find_true_sentence_punct_positions(trimmed)
    if not positions:
        return -1
    first_idx = positions[0]
    before = trimmed[:first_idx].strip()
    units = count_words_or_units(before)
    if 0 <= units <= 2:
        return first_idx + 1
    return -1

def find_late_punctuation_split(text: str) -> int:
    """
    Find sentence-ending punctuation near the end of text (within last 2 words/units).
    Returns the index position right after the punctuation, or -1 if none found.
    """
    trimmed = (text or "").strip()
    if not trimmed:
        return -1
    positions = find_true_sentence_punct_positions(trimmed)
    if not positions:
        return -1
    last_idx = positions[-1]
    after = trimmed[last_idx + 1:].strip()
    units = count_words_or_units(after)
    if 1 <= units <= 2:
        return last_idx + 1
    return -1

# Formatting helpers

def ensure_markdown_paragraphs(text: str) -> str:
    """Ensure Markdown paragraph spacing and collapse extra blank lines."""
    if not text:
        return text
    formatted = text.replace("\r\n", "\n")
    # Add a blank line after headings
    formatted = re.sub(r"(^#{1,6}\s+.*)\n([^\n#])", r"\1\n\n\2", formatted, flags=re.M)
    # Collapse 3+ newlines to 2
    formatted = re.sub(r"\n{3,}", "\n\n", formatted)
    # Trim leading/trailing blank lines
    formatted = re.sub(r"^\n+", "", formatted)
    formatted = re.sub(r"\n+$", "", formatted)
    return formatted

def remove_timestamps_and_meta(text: str) -> str:
    """Remove timestamp lines and obvious metadata while preserving original speech."""
    if not text:
        return ""
    import re
    ts_prefix = re.compile(r"^\*\*\[[0-9:]{2,8}\]\*\*\s*")
    lines = text.split('\n')
    kept = []
    for line in lines:
        s = line.strip()
        # Skip timestamps and metadata
        if s.startswith('**[') and ']**' in s:
            # New format: timestamp-only line like "**[00:12]**"
            if s.endswith(']**') and len(s) <= 14:
                continue
            # Old format: inline timestamp prefix like "**[00:12]** text"
            line = ts_prefix.sub("", line).strip()
            if not line:
                continue
        if s.startswith('# '):
            # Skip top-level heading (usually the video title; can be added back later)
            continue
        
        # Robust metadata check
        # Matches detected language markers like **Detected Language:** and localized equivalents.
        if re.match(r"^\*\*?(检测语言|语言概率|Detected Language|Language Probability)[:：]", s, flags=re.IGNORECASE):
            continue
            
        kept.append(line)
    # Normalize blank lines
    cleaned = '\n'.join(kept)
    return cleaned

def remove_transcript_heading(text: str) -> str:
    """Remove Transcript headings (any level) without changing body text."""
    if not text:
        return text
    import re
    # Remove headings like '## Transcript', '# Transcript Text', '### transcript'
    lines = text.split('\n')
    filtered = []
    for line in lines:
        stripped = line.strip()
        if re.match(r"^#{1,6}\s*transcript(\s+text)?\s*$", stripped, flags=re.I):
            continue
        filtered.append(line)
    return '\n'.join(filtered)

def extract_first_json_object(text: str) -> str | None:
    """Best-effort extraction of the first JSON object from a text response."""
    if not text:
        return None
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\s*```$", "", s)
    start = s.find("{")
    end = s.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    return s[start : end + 1]

def enforce_paragraph_max_chars(text: str, max_chars: int = 400) -> str:
    """Split by paragraph and keep each within max_chars, using sentence splits if needed."""
    if not text:
        return text
    import re
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p is not None]
    new_paragraphs = []
    for para in paragraphs:
        para = para.strip()
        if len(para) <= max_chars:
            new_paragraphs.append(para)
            continue
        # Split into sentences
        parts = re.split(r"([。！？\.!?]+\s*)", para)
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
        cur = ""
        for s in sentences:
            candidate = (cur + (" " if cur else "") + s).strip()
            if len(candidate) > max_chars and cur:
                new_paragraphs.append(cur)
                cur = s
            else:
                cur = candidate
        if cur:
            new_paragraphs.append(cur)
    return "\n\n".join([p.strip() for p in new_paragraphs if p is not None])

def extract_pure_text(raw_transcript: str) -> str:
    """
    Extract plain text from a raw transcript, removing timestamps and metadata.
    """
    import re
    ts_prefix = re.compile(r"^\*\*\[[0-9:]{2,8}\]\*\*\s*")
    lines = raw_transcript.split('\n')
    text_lines = []
    
    for line in lines:
        line = line.strip()
        # Skip timestamps, headings, metadata
        if not line:
            continue
        if line.startswith('**[') and ']**' in line:
            # Timestamp-only line
            if line.endswith(']**') and len(line) <= 14:
                continue
            # Inline timestamp prefix -> strip and keep remainder
            line = ts_prefix.sub("", line).strip()
            if not line:
                continue
        if (line.startswith('#') or
            line.startswith('**检测语言:**') or
            line.startswith('**语言概率:**')):
            continue
        text_lines.append(line)
    
    return ' '.join(text_lines)

def split_into_sentences(text: str) -> list[str]:
    """
    Split text into sentences, accounting for CJK punctuation.
    """
    import re
    
    # Sentence terminators for CJK/Latin
    sentence_endings = r'[.!?。！？;；]+'
    
    # Split sentences while keeping punctuation
    parts = re.split(f'({sentence_endings})', text)
    
    sentences = []
    current = ""
    
    for i, part in enumerate(parts):
        if re.match(sentence_endings, part):
            # Sentence terminator; append to current sentence
            current += part
            if current.strip():
                sentences.append(current.strip())
            current = ""
        else:
            # Sentence content
            current += part
    
    # Handle trailing text without terminator
    if current.strip():
        sentences.append(current.strip())
    
    return [s for s in sentences if s.strip()]

def join_sentences(sentences: list[str]) -> str:
    """
    Recombine sentences into a paragraph.
    """
    return ' '.join(sentences)

def detect_language(text: str) -> str:
    """Detect primary language of text (en, zh, ja, ko)."""
    if not text:
        return "en"
        
    # Check for metadata marker
    if "**检测语言:**" in text:
        lines = text.split('\n')
        for line in lines:
            if "**检测语言:**" in line:
                lang = line.split(":")[-1].strip()
                return lang

    # Based on character set
    import re
    total_chars = len(text)
    if total_chars == 0:
        return "en"
    
    # Chinese
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    chinese_ratio = chinese_chars / total_chars
    
    # Japanese
    japanese_chars = len(re.findall(r'[\u3040-\u309f\u30a0-\u30ff]', text))
    japanese_ratio = japanese_chars / total_chars
    
    # Korean
    korean_chars = len(re.findall(r'[\uac00-\ud7af]', text))
    korean_ratio = korean_chars / total_chars
    
    if chinese_ratio > 0.1:
        return "zh"
    elif japanese_ratio > 0.05:
        return "ja"
    elif korean_ratio > 0.05:
        return "ko"
    else:
        return "en"

def smart_chunk_text(text: str, max_chars: int = 4000) -> list[str]:
    """Smart chunking (paragraphs then sentences) under a character limit."""
    if not text:
        return []
    import re
    chunks = []
    paragraphs = [p for p in text.split('\n\n') if p.strip()]
    cur_chunk = ""
    
    for p in paragraphs:
        # Check if adding this paragraph exceeds max
        # +2 for "\n\n"
        if len(cur_chunk) + len(p) + 2 > max_chars and cur_chunk:
            chunks.append(cur_chunk.strip())
            cur_chunk = p
        else:
            if cur_chunk:
                cur_chunk += "\n\n" + p
            else:
                cur_chunk = p
    
    if cur_chunk.strip():
        chunks.append(cur_chunk.strip())
        
    # Second pass: split chunks that are still too large by sentence
    final_chunks = []
    sentence_split_re = re.compile(r"([.!?。！？]+)")
    
    for c in chunks:
        if len(c) <= max_chars:
            final_chunks.append(c)
        else:
            # Splits but keeps delimiters
            parts = sentence_split_re.split(c)
            # Reassemble sentences
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
                
            scur = ""
            for s in sentences:
                candidate = (scur + " " + s).strip() if scur else s
                if len(candidate) > max_chars and scur:
                    final_chunks.append(scur.strip())
                    scur = s
                else:
                    scur = candidate
            if scur.strip():
                final_chunks.append(scur.strip())
                
    return final_chunks
