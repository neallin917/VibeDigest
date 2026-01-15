# Tasks: AI Chat Implementation (Agentic)

## 1. Dependencies & Setup
- [ ] 1.1 Frontend: Install `ai` (Vercel SDK), `@assistant-ui/react`, `@assistant-ui/react-ai-sdk` <!-- id: 100 -->
- [ ] 1.2 Backend: Ensure `langchain` + `langgraph` are ready for tool calling <!-- id: 101 -->

## 2. Backend Implementation (Tools & API)
- [ ] 2.1 Refactor `VideoProcessor` or create `TaskService` to be callable as a Tool (independent of HTTP endpoint) <!-- id: 200 -->
- [ ] 2.2 Create `backend/tools.py`: Implement `preview_video(url)` and `start_processing(url)` <!-- id: 201 -->
- [ ] 2.3 Update `chat_router.py`: Support OpenAI Tools integration in `StreamingResponse` <!-- id: 202 -->
- [ ] 2.4 Implement "Context Switching": Logic to inject transcript into System Message when `task_id` is contextually active <!-- id: 203 -->

## 3. Frontend Implementation (Generative UI)
- [ ] 3.1 Create `src/components/chat/tools/VideoCard.tsx`: Displays thumbnail/title before processing <!-- id: 300 -->
- [ ] 3.2 Create `src/components/chat/tools/ProgressCard.tsx`: Implement "Comprehensive Plan" style (Progress Bar + Step List) subscribed to Supabase Realtime <!-- id: 301 -->
- [ ] 3.3 Create `src/components/chat/AssistantChat.tsx`: Configure `assistant-ui` runtime with `tools` definitions mapping to the components above <!-- id: 302 -->

## 4. Integration
- [ ] 4.1 Global Chat: Add `AssistantChat` to the global layout (e.g., Sidebar or Drawer) so it's accessible from "New Task" context <!-- id: 400 -->
- [ ] 4.2 Verify URL -> Preview -> Process -> Q&A flow <!-- id: 401 -->
