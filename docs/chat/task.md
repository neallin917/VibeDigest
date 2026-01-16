# Task: Chat Module Development

## Milestone 1: Backend Foundation (Database & CRUD API)
- [x] **Database Migration** <!-- id: 0 -->
  - [x] Create `backend/sql/12_chat_module.sql` with `chat_threads` table, enum, and status index.
  - [x] Apply migration to Supabase.
  - [x] Verify table existence.
- [x] **API Endpoints (`backend/routers/threads.py`)** <!-- id: 1 -->
  - [x] Setup `APIRouter` in `backend/main.py`.
  - [x] Implement `POST /api/threads` (Create).
  - [x] Implement `GET /api/threads` (List != deleted).
  - [x] Implement `PATCH /api/threads/{id}` (Update Title).
  - [x] Implement `DELETE /api/threads/{id}` (Soft Delete).
  - [x] Implement `GET /api/threads/{id}/messages` (History).
  - [x] **Verification**: Test all endpoints using `curl`.

## Milestone 2: Intelligence Engine (LangGraph & Streaming)
- [x] **Graph Persistence** <!-- id: 2 -->
  - [x] Add `AsyncPostgresSaver` to `chat_graph.py`.
  - [x] Ensure `thread_id` consistency.
- [x] **Streaming Endpoint** <!-- id: 3 -->
  - [x] Implement `POST /api/chat/{thread_id}/stream`.
  - [x] Connect to LangGraph runner.
  - [x] Implement `updated_at` trigger logic on first token.
  - [x] **Verification**: Streaming & persistence fully tested (2026-01-16). Thread context remembered.

## Milestone 3: Frontend Integration (Sidebar & Chat)
- [x] **API Client Layer** <!-- id: 4 -->
  - [x] Create `frontend/src/lib/api/threads.ts` (fetch wrappers).
  - [x] Create `frontend/src/hooks/useThreads.ts` (TanStack Query).
- [x] **Chat UI Refactor** <!-- id: 5 -->
  - [x] Refactor `AssistantChat.tsx` to use `useThreads` and `activeThreadId`.
  - [x] Refactor `Sidebar` + `ThreadList` to use real data.
  - [x] Implement "New Chat" button logic.
  - [ ] **Verification**: Full manual test (Multi-session switching).
