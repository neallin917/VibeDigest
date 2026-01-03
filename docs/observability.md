# Observability Strategy (Langfuse)

This document outlines the observability strategy for AI Video Transcriber using Langfuse. The goal is to provide granular visibility into the AI pipeline, enabling effective debugging, performance monitoring, and cost analysis.

## Core Concepts

We adopt a structured approach to tracing, separating "Actions", "Parameters", and "States".

### 1. Trace Name (Action)
Describes **WHAT** is being done. Keep these stable and verb-based.

*   `Transcript Optimization`: The process of cleaning up raw transcripts.
*   `Summary Generation`: Generating the structured summary from the transcript.
*   `Translation`: Translating content into a target language.
*   `JSON Repair`: Fixing malformed JSON outputs.

### 2. Session ID (Context)
Describes **WHERE** the action belongs.

*   **Value**: `task_id` (UUID)
*   **Purpose**: Groups all AI operations related to a single video task (transcription, summarization, translation) into one session view.

### 3. User ID (Actor)
Describes **WHO** initiated the action.

*   **Value**: `user_id` (UUID)
*   **Purpose**: Tracks usage patterns and costs per user.

### 4. Metadata (Parameters)
Describes **HOW** the action was configured. Use this for high-cardinality data.

*   `target_language`: e.g., "zh", "en", "es"
*   `video_duration`: e.g., 120 (seconds)
*   `model`: e.g., "gpt-4o", "gpt-4o-mini"
*   `chunk_index`: e.g., 1, 2 (for multi-chunk processing)
*   `attempt`: e.g., 0, 1 (for retries)

### 5. Tags (State/Environment)
Describes **STATUS** or **ENVIRONMENT**. Use this for low-cardinality grouping.

*   `retry`: Indicates a retry attempt after failure.
*   `fallback`: Indicates usage of a fallback model.
*   `prod` / `dev`: Environment markers.

## Implementation Guide (Langfuse V3)

In Langfuse V3, we use `propagate_attributes` to manage trace-level context (session, user, tags) globally within a pipeline, simplifying individual component calls.

### 1. Root Context (Pipeline Level)
Set the trace-level attributes once at the root of the task using `propagate_attributes`.

```python
from langfuse import propagate_attributes, get_client

langfuse = get_client()

with langfuse.start_as_current_observation(name="Main Pipeline"):
    # All child calls inside this block inherit these attributes
    with propagate_attributes(
        session_id=task_id,
        user_id=user_id,
        tags=["prod", "pipeline"]
    ):
        await run_logic()
```

### 2. Component Calls (Simplified Integration)
Components like `Summarizer` now only need to provide the action `name`. The `langfuse.openai` wrapper handles the rest.

```python
# Simplified trace_config - trace attributes are inherited automatically
trace_config = {
    "name": "Summary Generation",
    "metadata": {
        "language": "zh",
        "video_duration": 300
    }
}

# The wrapper automatically captures tokens, model, and links to the current trace
response = client.chat.completions.create(
    model="gpt-4o",
    name=trace_config["name"],
    **kwargs
)
```

This configuration ensures consistent tracking with significantly less boilerplate and better context inheritance.
