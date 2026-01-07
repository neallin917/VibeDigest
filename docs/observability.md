# Observability Strategy (LangSmith)

This document outlines the observability strategy for AI Video Transcriber using [LangSmith](https://smith.langchain.com/). The goal is to provide granular visibility into the AI pipeline, enabling effective debugging, performance monitoring, and cost analysis.

## Core Concepts

We adopt a structured approach to tracing, leveraging LangSmith's native concepts of **Runs**, **Metadata**, and **Tags**.

### 1. Run Name (Action)
Describes **WHAT** is being done. Keep these stable and verb-based.

*   `Transcript Optimization`: The process of cleaning up raw transcripts.
*   `Summary Generation`: Generating the structured summary from the transcript.
*   `Content Classification`: classifying the video content type.
*   `Translation`: Translating content into a target language.

### 2. Metadata (Context & Parameters)
Describes **WHO** and **HOW** the action was performed. Use this for high-cardinality data.

*   `task_id`: Groups all operations for a single video.
*   `user_id`: Tracks usage patterns per user.
*   `target_language`: e.g., "zh", "en".
*   `video_duration`: Length of the input video.
*   `model`: e.g., "gpt-4o", "gpt-4o-mini".
*   `chunk_index`: For multi-chunk processing.

### 3. Tags (State/Environment)
Describes **STATUS** or **ENVIRONMENT**. Use this for low-cardinality grouping.

*   `prod` / `dev`: Environment markers.
*   `retry`: Indicates a retry attempt.
*   `fallback`: Indicates usage of a fallback model.

## Configuration

LangSmith is integrated via LangChain's built-in tracing. Configure it using environment variables in `.env`:

```bash
# Enable Tracing
LANGCHAIN_TRACING_V2=true

# API Key
LANGCHAIN_API_KEY=lsv2_...

# Project Name (Optional, defaults to "default")
LANGCHAIN_PROJECT=ai-video-transcriber
```

## Implementation Guide

We use LangChain's `ainvoke` method, which accepts a `config` dictionary to pass tracing information. This removes the need for manual span management in most cases.

### Component Calls

When invoking an LLM or Chain, provide the `run_name` and `metadata` in the `config` argument.

```python
# Prepare trace configuration
trace_config = {
    "run_name": "Summary Generation",
    "metadata": {
        "task_id": "123-abc",
        "user_id": "user-456",
        "language": "zh",
        "video_duration": 300
    },
    "tags": ["prod", "summary"]
}

# Invoke the model with config
response = await llm.ainvoke(
    messages, 
    config=trace_config
)
```

### Trace Inheritance
LangChain automatically handles trace nesting. If you call `ainvoke` within another traced run, it will automatically be attached as a child run, provided the context is propagated correctly (which `asyncio` handles naturally in most Python environments).

### Custom / Manual Tracing
For non-LangChain code blocks, you can use the `@traceable` decorator from `langsmith` if needed, but our primary pattern is to wrap logic in LangChain runnables or pass config to `ainvoke`.
