# Chat Module Development Milestones

## Milestone 1: Backend Foundation (Database & CRUD API)
**Goal**: Establish data persistence and basic management capability.
**Existing Code**: `backend/main.py` (needs new router), `backend/sql` (needs new schema).

### Deliverables
1.  **Database Migration**:
    -   `chat_threads` table with `status` enum (`active`, `deleted`, `archived`) and proper constraints.
    -   RLS Policies securing access to own threads.
    -   Index: `CREATE INDEX ... WHERE status != 'deleted'` for efficient listing.
2.  **API Endpoints (`backend/routers/threads.py`)**:
    -   `POST /api/threads`: Create a new thread (e.g., "New Chat").
    -   `GET /api/threads?task_id=...`: Return list of non-deleted threads, sorted by `updated_at DESC`.
    -   `PATCH /api/threads/{id}`: Update title.
    -   `DELETE /api/threads/{id}`: Soft delete (`status='deleted'`).
    -   `GET /api/threads/{id}/messages`: Fetch history (empty initially).

### Verification Plan
-   [ ] **Schema Check**:
    ```sql
    SELECT * FROM pg_indexes WHERE tablename = 'chat_threads';
    -- Verify idx_chat_threads_list_visible exists
    ```
-   [ ] **API Functional Test** (via `curl`):
    1.  Create 2 threads.
    2.  List threads (verify status != deleted, sort order).
    3.  Delete 1 thread.
    4.  List again (verify deleted one is gone).

## Milestone 2: Intelligence Engine (LangGraph & Streaming)
**Goal**: Enable the "Brain" to reply with persistent memory.
**Existing Code**: `backend/agent/chat_graph.py` (Current: in-memory only), `backend/routers/threads.py`.

### Deliverables
1.  **Dependencies**:
    -   Add `langgraph-checkpoint-postgres` to `backend/requirements.txt`.

2.  **Graph Persistence (`backend/agent/chat_graph.py`)**:
    -   Import `AsyncPostgresSaver` from `langgraph.checkpoint.postgres`.
    -   Initialize `checkpointer = AsyncPostgresSaver.from_conn_string(POSTGRES_URI)`.
    -   Update `create_react_agent` to include `checkpointer=checkpointer`.

3.  **Streaming Endpoint (`backend/routers/threads.py`)**:
    -   Define `ChatRequest` model (list of messages).
    -   Implement `POST /api/chat/{thread_id}/stream`:
        -   Check thread ownership.
        -   Initialize `graph` (ensure DB connection is managed).
        -   Run `graph.astream_events` with `config={"configurable": {"thread_id": thread_id}}`.
        -   Stream SSE events (tokens).
        -   Background task: Update `chat_threads.updated_at` timestamp.

### Verification Plan
-   [x] **Dependency Check**: Verified container pip install (fixed `Dockerfile.langgraph` to include `requirements.core.txt`).
-   [x] **Connection Check**: `AsyncPostgresSaver` connects to LangGraph postgres DB.
-   [x] **Stream Test** (manual verification 2026-01-16):
    -   Created thread successfully.
    -   Sent message via `curl` and received streaming SSE tokens.
    -   Verified persistence: AI remembered context in follow-up questions.
    -   Verified `updated_at` and `metadata` fields are updated on stream.

## Milestone 3: Frontend Integration (Sidebar & Chat)
**Goal**: Connect UI to the new Backend capability.
**Existing Code**: `frontend/src/components/chat/AssistantChat.tsx` (Refactor needed).

### Deliverables
1.  **API Client Layer**:
    -   Wrappers for all Milestone 1 endpoints.
    -   TanStack Query Hooks: `useThreads`, `useCreateThread` (invalidate list), `useDeleteThread` (optimistic update).
2.  **Chat UI Refactor**:
    -   **Global State**: `activeThreadId`.
    -   **ThreadList**: Connect to `useThreads` hook. Render real thread titles.
    -   **Chat Area**: Reload `Runtime` when `activeThreadId` changes.
    -   **"New Chat" Logic**: Immediate API call to create thread -> switch ID -> focus input.

### Integration Test Plan
1.  **Load Page**: Verify Sidebar loads list of threads.
2.  **Switching**: Click distinct threads -> verify Chat Area loads different history.
3.  **Chatting**: Send message -> verify streaming response.
4.  **New Chat**: Click "New Chat" -> verify new item appears in Sidebar immediately.
5.  **Deleting**: Click Delete on item -> verify it disappears from list.
