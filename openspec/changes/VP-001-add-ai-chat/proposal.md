# Change: Add AI Chat Feature (Agentic Workflow)

## Why
Users prefer a natural language interface to drive the entire workflow. Instead of filling forms, they want to paste a URL into a chat, see the agent's plan/progress, and immediately transition into "talking to the video" once ready. This unifies "Task Creation" and "Task Consumption" into a single Agentic Experience.

## What Changes
- [MODIFIED] **Scope Expansion**: Chat is no longer just for Q&A on *finished* tasks. It can now **start** tasks.
- [NEW] **Agentic Capability**:
  - **Intent Recognition**: Agent detects video URLs and proposes a processing plan.
  - **Tool Use**: Agent triggers the backend processing pipeline.
  - **Generative UI**: Chat renders interactive "Tools" (Video Card, Progress Tracker, Plan Table) instead of just text.
- [NEW] **Workflow**:
  1. User inputs URL.
  2. Agent shows "Video Card" (preview) and "Processing Plan".
  3. Agent streams progress updates.
  4. Upon completion, context switches to "Q&A Mode" with the transcript.

## Impact
- **Specs**: Update `specs/chat` to include orchestration.
- **Frontend**: significantly more complex `AssistantChat` with custom tool UIs (`VideoCard`, `ProgressStatus`).
- **Backend**: Chat endpoint must support function calling / tools (OpenAI Tools API).
