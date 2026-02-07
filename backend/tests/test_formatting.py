import pytest
from types import SimpleNamespace
from services.formatting import (
    _split_long_sentence_segments,
    _merge_segments_into_sentences,
    _group_sentences_into_paragraphs_v2,
    format_markdown_from_raw_segments,
    MAX_SENTENCE_DURATION_SECONDS
)

def make_segment(text, start, end):
    return SimpleNamespace(text=text, start=start, end=end)

def test_split_long_sentence_segments():
    # 1. Normal segments
    segs = [make_segment("Hello", 0, 1), make_segment("World", 1, 2)]
    chunks = _split_long_sentence_segments(segs)
    assert len(chunks) == 1
    assert chunks[0]["text"] == "Hello World"

    # 2. Exceeding duration
    long_segs = [make_segment("Part1", 0, 10), make_segment("Part2", 10, 30)] 
    # Total 30s > 24s limit
    chunks = _split_long_sentence_segments(long_segs)
    assert len(chunks) == 2
    assert chunks[0]["text"] == "Part1"
    assert chunks[1]["text"] == "Part2"

def test_merge_segments_into_sentences():
    # 1. Simple sentence
    segs = [make_segment("Hello world.", 0, 1)]
    merged = _merge_segments_into_sentences(segs)
    assert len(merged) == 1
    assert merged[0]["text"] == "Hello world."

    # 2. Split across segments
    segs = [make_segment("Hello", 0, 1), make_segment("world.", 1, 2)]
    merged = _merge_segments_into_sentences(segs)
    assert len(merged) == 1
    assert merged[0]["text"] == "Hello world."

    # 3. Early punctuation split
    # For early split to trigger, it usually needs preceding text.
    # Let's try "Sentence end. New start"
    segs = [make_segment("Previous", 0, 1), make_segment(". Start", 1, 2)]
    merged = _merge_segments_into_sentences(segs)
    assert len(merged) == 2
    assert merged[0]["text"] == "Previous ."
    assert merged[1]["text"] == "Start"

def test_group_sentences_into_paragraphs_v2():
    sentences = [
        {"start": 0, "end": 2, "text": "Sentence 1."},
        {"start": 2, "end": 4, "text": "Sentence 2."},
        {"start": 10, "end": 12, "text": "Sentence 3."} # Big gap
    ]
    
    paras = _group_sentences_into_paragraphs_v2(
        sentences, max_chars=100, gap_seconds=2.0, max_duration_seconds=30
    )
    assert len(paras) == 2
    assert "Sentence 1. Sentence 2." in paras[0]["text"]
    assert "Sentence 3." in paras[1]["text"]

def test_format_markdown_from_raw_segments():
    raw_segments = [
        {"start": 0, "end": 2, "text": "Hello world."},
        {"start": 3, "end": 5, "text": "Next paragraph."}
    ]
    md = format_markdown_from_raw_segments(raw_segments)
    # Checks for [00:00] format
    assert "**[00:00]**" in md
    assert "Hello world." in md
    assert "Next paragraph." in md