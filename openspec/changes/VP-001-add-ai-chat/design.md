# Design: AI Chat Architecture (Agentic)

## Context
The user wants an "Agentic" flow: Input URL -> Agent Plans/Executes -> Q&A. This requires the Chat interface to support "Generative UI" (rendering components based on tool outputs).

## Goals / Non-Goals
- **Goals**:
  - **Unified Interface**: One chat window for creation and consumption.
  - **Transparency**: User sees *what* the agent is doing (Plan) and *how* it's going (Progress).
  - **Visual Feedback**: Rich UI for Video Cards and Status, not just text.
- **Non-Goals**:
  - Full autonomous agent that browses the web (intent is strictly "Process this video").

## Decisions

### 1. Frontend: Tool-Driven Generative UI
- **Decision**: Use `assistant-ui`'s `toolUI` capabilities.
- **Implementation**:
  - Register client-side components (`VideoPreview`, `ProcessingTracker`) that render when the backend invokes specific tools.
  - **UI Pattern**: The `ProcessingTracker` MUST match the "Tool UI Comprehensive Plan" design:
    - **Header**: Title (e.g., "Processing Video") and Subtitle.
    - **Progress Bar**: Linear progress indicator (e.g., "2 of 5 steps completed").
    - **Step List**: Vertical list of steps with state icons (Checkmark for done, Spinner/Dashed for in-progress, Empty for pending).
    - **Collapsible**: Ability to see details but keep it clean.
  - State management: The Chat component will need to observe the `tasks` table (Realtime) to update the `ProcessingTracker` component live, rather than relying solely on the LLM token stream.

### 2. Backend: Tool-Enabled LLM
- **Decision**: Upgrade `POST /api/chat` to use OpenAI Tools.
- **Tools**:
  - `preview_video(url)`: Returns metadata to render the Video Card.
  - `create_processing_task(url)`: Starts the LangGraph workflow.
  - `get_task_status(task_id)`: (Optional) or rely on frontend subscription.
- **Flow**:
  1. User: "Process https://youtu.be/..."
  2. LLM calls `preview_video`.
  3. UI renders `VideoPreview` card (User confirms or auto-proceeds).
  4. LLM calls `create_processing_task`.
  5. UI renders `ProcessingTracker`.
  6. Backend finishes; LLM switches context to "Q&A".

### 3. "Talking to the Video" Transition
- **Challenge**: Passing the massive transcript to the LLM context.
- **Strategy**:
  - **Phase 1 (Creation)**: System prompt is "You are a helpful assistant helping process videos...".
  - **Phase 2 (Q&A)**: Once task completes, the frontend or backend effectively "injects" the new context (RAG or full context) and the system prompt changes to "You are an expert on this video...".
  - *Refinement*: The Backend Chat Router will check if a `task_id` is present/completed. If so, it loads the transcript into context.

## Performance & Scalability Guardrails

### 1. Cost & Latency Control (Context Management)
- **Problem**: Full transcripts (e.g., 2 hour video) can exceed 100k tokens, causing massive latency (TTFT > 5s) and high cost per message ($0.10+).
- **Decision (MVP Guardrail)**:
  - **Primary Context**: Inject **Summary + Key Takeaways** (approx. 1-2k tokens) by default.
  - **Secondary Context**: Limit raw transcript injection to the **first 15 minutes** OR use a "Lazy Loading" strategy (not in MVP).
  - **Strict Limit**: Cap total LLM context at **16k tokens** regardless of video length. Truncate efficiently.
- **Impact**: Ensures chat remains snappy (<1s latency) and cheap.

### 2. Availability (Error Handling)
- **Problem**: Streaming connections (SSE) are fragile on mobile/unstable networks.
- **Decision**:
  - **Frontend**: `useChat` hook must implement **exponential backoff retry** for failed message sends.
  - **Backend**: Statelessness ensures checking connection health is easy. If stream breaks, client just retries.

### 3. Scalability (Realtime Channels)
- **Problem**: High volume of Realtime subscriptions for `ProcessingTracker`.
- **Decision**: usage is scoped to `taskId` (Topic: `tasks:id=uuid`). Supabase limits are high (concurrent connections).
- **Optimization**: Frontend MUST `unsubscribe()` immediately when the component unmounts or the task is complete.

## Resource Constraints & Bottlenecks
Beyond transcription, the primary resource constraints are:
1. **Network Bandwidth (Download)**: Even with `bestaudio`, long podcasts can be 50MB+.
   - *Mitigation*: The system currently uses `yt-dlp` with `bestaudio` to avoid video data. Future: Use Supadata (already implemented) to skip download entirely.
2. **Audio Processing (FFmpeg)**: Converting to `m4a/16k` eats CPU.
   - *Mitigation*: Task is async (Celery/Background).
3. **LLM Latency (Summarization)**: Recursive summarization of long content (e.g. 2h video) involves multiple serial LLM round-trips.
   - *Mitigation*: Parallelize chunk summarization in future (Map-Reduce pattern).

## Risks / Trade-offs
- **Complexity**: Handling tool states (call, result, error) in UI is harder than pure text.
- **Latency**: "Agentic" round trips (Tool Call -> Client -> Tool Result -> LLM) add delay.
- **Mitigation**: Optimistic UI updates. Use `streamUI` from Vercel AI SDK if possible to push UI components from server.

## Migration Plan
- This transforms `VP-001` from a simple "Add Feature" to a "New Core Workflow". We will keep the existing "Form" based creation as a fallback/alternative for now.
