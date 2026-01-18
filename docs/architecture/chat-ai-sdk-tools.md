# VibeDigest Chat Architecture (AI SDK + Tool Calling)

> **Status**: ✅ **Active Architecture** (Recommended Implementation)  
> **Last Updated**: 2026-01-18  
> **Replaces**: `docs/chat/02_technical_architecture.md` (LangGraph-based approach)

---

## 1. Executive Summary

This document defines the **target architecture** for VibeDigest's chat functionality, using **Vercel AI SDK v5 + Tool Calling** as the primary orchestration layer. The architecture prioritizes:

- **Simplicity**: Leverage existing AI SDK implementation
- **Extensibility**: Tool-based design for easy feature additions
- **Maintainability**: Clear separation between frontend orchestration and backend processing
- **Performance**: Edge-based chat with on-demand tool calls

---

## 2. Architecture Overview

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js + AI SDK v5)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ChatContainer.tsx                                                      │
│   ├── useChat({ api: '/api/chat' })                                     │
│   │      └── Only sends messages, all logic in Route Handler            │
│   │                                                                      │
│   └── Supabase Realtime ──→ Monitors tasks table for UI updates         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Next.js Route Handler: /api/chat/route.ts                   │
│              (AI SDK + Tool Calling - Core Orchestration)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   1. Auth (Supabase)                                                     │
│   2. streamText() with TOOLS:                                            │
│      ┌─────────────────────────────────────────────────────────────┐    │
│      │  tools: {                                                    │    │
│      │    get_task_status:    Query task status (from Supabase)     │    │
│      │    get_task_outputs:   Query outputs content (from Supabase) │    │
│      │    create_task:        Create new task (call Python Backend) │    │
│      │    preview_video:      Preview video info (call Python)      │    │
│      │  }                                                           │    │
│      └─────────────────────────────────────────────────────────────┘    │
│   3. onFinish: save messages to chat_messages                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
┌──────────────────────────────┐   ┌──────────────────────────────────────┐
│     Supabase (Data Plane)     │   │      Python Backend (Compute Plane)   │
├──────────────────────────────┤   ├──────────────────────────────────────┤
│  - tasks                      │   │  POST /api/process-video              │
│  - task_outputs              │   │  POST /api/preview-video (new?)       │
│  - chat_threads              │   │       └──→ workflow.py (task processing)│
│  - chat_messages             │   │                                        │
└──────────────────────────────┘   │  DEPRECATED:                           │
                                   │  - /api/threads/* (LangGraph chat)    │
                                   │  - agent/chat_graph.py                │
                                   └──────────────────────────────────────┘
```

### 2.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **AI SDK + Tools over LangGraph** | Existing AI SDK code works, LangGraph persistence has bugs |
| **Tool-based context fetching** | Avoids system prompt length limits, enables on-demand queries |
| **Frontend orchestration** | Leverages Vercel Edge, reduces Python backend complexity |
| **Supabase as single source of truth** | Realtime updates + RAG data storage |

---

## 3. Component Architecture

### 3.1 Frontend Components

```typescript
// ChatContainer.tsx - Main chat interface
export function ChatContainer() {
  const { messages, append, isLoading } = useChat({
    api: '/api/chat',
    // All logic moved to Route Handler
  })
  
  // URL detection moved to tools
  // Task tracking via Supabase Realtime
}
```

### 3.2 Route Handler (/api/chat/route.ts)

```typescript
export async function POST(req: Request) {
  const { messages, taskId, threadId } = await req.json()
  
  // 1. Auth (Supabase)
  const user = await supabase.auth.getUser()
  
  // 2. AI SDK with Tools
  const result = streamText({
    model: openai.chat(MODEL_NAME),
    messages: convertToCoreMessages(messages),
    tools: {
      get_task_status: {
        description: "Get current processing status of a video task",
        parameters: z.object({ taskId: z.string() }),
        execute: async ({ taskId }) => {
          const { data } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single()
          return data
        }
      },
      get_task_outputs: {
        description: "Get processed content (transcript/summary) for a task",
        parameters: z.object({ 
          taskId: z.string(),
          kinds: z.array(z.enum(['script', 'summary', 'summary_source']))
        }),
        execute: async ({ taskId, kinds }) => {
          const { data } = await supabase
            .from('task_outputs')
            .select('*')
            .eq('task_id', taskId)
            .in('kind', kinds)
            .eq('status', 'completed')
          return data
        }
      },
      create_task: {
        description: "Start processing a new video URL",
        parameters: z.object({ 
          videoUrl: z.string(),
          summaryLanguage: z.string().default('zh')
        }),
        execute: async ({ videoUrl, summaryLanguage }) => {
          const response = await fetch(`${process.env.BACKEND_URL}/api/process-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              video_url: videoUrl,
              summary_language: summaryLanguage 
            })
          })
          return await response.json()
        }
      },
      preview_video: {
        description: "Get video metadata without processing",
        parameters: z.object({ url: z.string() }),
        execute: async ({ url }) => {
          const response = await fetch(`${process.env.BACKEND_URL}/api/preview-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          })
          return await response.json()
        }
      }
    },
    onFinish: async ({ text }) => {
      // Save messages to chat_messages table
      if (threadId) {
        await supabase.from('chat_messages').insert({
          thread_id: threadId,
          role: 'assistant',
          content: text
        })
      }
    }
  })
  
  return result.toDataStreamResponse()
}
```

### 3.3 Python Backend (Simplified)

```python
# main.py - Keep only task processing endpoints
@app.post("/api/process-video")
async def process_video(background_tasks: BackgroundTasks, ...):
    # Existing task processing logic
    pass

@app.post("/api/preview-video")  # New endpoint
async def preview_video(url: str = Form(...)):
    # Extract metadata without downloading
    info = await video_processor.extract_info_only(url)
    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "author": info.get("author")
    }

# DEPRECATED: Remove /api/threads/* endpoints
# DEPRECATED: Remove agent/chat_graph.py
```

---

## 4. Data Flow

### 4.1 Chat Message Flow

1. **User sends message** → `ChatContainer.append()`
2. **Route Handler receives** → `/api/chat`
3. **AI SDK processes** → Determines if tools needed
4. **Tool calls execute** → Query Supabase or call Python backend
5. **Response streams** → Real-time token streaming
6. **Messages saved** → `chat_messages` table

### 4.2 Task Creation Flow

1. **User sends URL** → AI detects via `create_task` tool
2. **Tool calls Python** → `POST /api/process-video`
3. **Python processes** → `workflow.py` execution
4. **Status updates** → Supabase Realtime pushes to frontend
5. **User can query** → `get_task_status` tool for progress

### 4.3 Context Retrieval Flow

1. **User asks about video** → AI calls `get_task_outputs`
2. **Tool queries Supabase** → Fetches transcript/summary
3. **AI answers** → Based on retrieved content
4. **No system prompt bloat** → Context fetched on-demand

---

## 5. Database Schema

### 5.1 Existing Tables (Unchanged)

```sql
-- Core task processing
tasks (id, user_id, video_url, status, video_title, thumbnail_url, ...)
task_outputs (id, task_id, kind, content, status, ...)

-- Chat functionality
chat_threads (id, user_id, task_id, title, status, ...)
chat_messages (id, thread_id, role, content, created_at, ...)
```

### 5.2 New Python Endpoints

```python
# Add to main.py
@app.post("/api/preview-video")
async def preview_video(url: str = Form(...)):
    """Get video metadata without full processing."""
    info = await video_processor.extract_info_only(url)
    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "author": info.get("author"),
        "url": url
    }
```

---

## 6. Migration Plan

### Phase 1: Core Tool Implementation (Week 1)
- [ ] Implement `/api/chat/route.ts` with basic tools
- [ ] Add `get_task_status` and `get_task_outputs` tools
- [ ] Test tool calling with existing tasks
- [ ] Remove old context injection logic

### Phase 2: Task Creation Tools (Week 1-2)
- [ ] Implement `create_task` tool
- [ ] Add `preview_video` tool
- [ ] Add Python `/api/preview-video` endpoint
- [ ] Update frontend to remove URL detection

### Phase 3: Cleanup & Optimization (Week 2)
- [ ] Remove deprecated Python chat endpoints
- [ ] Remove `agent/chat_graph.py` and related files
- [ ] Update documentation
- [ ] Add error handling and edge cases

### Phase 4: Enhanced Features (Week 3+)
- [ ] Add more tools (retry, delete, export)
- [ ] Implement tool calling for admin functions
- [ ] Add rate limiting and usage tracking
- [ ] Optimize for token usage

---

## 7. Comparison with Legacy Approach

| Aspect | New (AI SDK + Tools) | Legacy (LangGraph) |
|--------|---------------------|--------------------|
| **Development Speed** | ✅ Fast (leverages existing code) | ❌ Slow (persistence bugs) |
| **Debugging** | ✅ Easy (Vercel logs) | ❌ Hard (LangGraph server) |
| **Tool Extensibility** | ✅ Simple (add tool function) | ❌ Complex (modify graph) |
| **Deployment** | ✅ Edge-native | ❌ Requires Python server |
| **Maintenance** | ✅ Low (TypeScript only) | ❌ High (Python + TS) |
| **Performance** | ✅ Fast cold starts | ❌ Slower warm-up |
| **Real-time** | ✅ Native streaming | ❌ Complex SSE setup |

---

## 8. Implementation Guidelines

### 8.1 Tool Design Principles

1. **Single Responsibility**: Each tool does one thing well
2. **Idempotent**: Safe to call multiple times
3. **Error Handling**: Graceful failures with helpful messages
4. **Type Safety**: Zod schemas for all parameters
5. **Logging**: Structured logs for debugging

### 8.2 Security Considerations

- **Auth Validation**: All tools verify user context
- **Rate Limiting**: Tool calls per user/session
- **Input Sanitization**: Validate all parameters
- **Output Filtering**: Don't expose sensitive data

### 8.3 Performance Optimization

- **Caching**: Cache frequently accessed data
- **Lazy Loading**: Fetch data only when needed
- **Batch Operations**: Combine multiple queries when possible
- **Token Efficiency**: Minimize context in prompts

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
// Test tool functions
describe('get_task_status tool', () => {
  it('should return task status for valid taskId', async () => {
    const result = await tools.get_task_status.execute({ taskId: 'valid-id' })
    expect(result).toHaveProperty('status')
  })
})
```

### 9.2 Integration Tests

```typescript
// Test full chat flow
describe('Chat with tools', () => {
  it('should create task when URL provided', async () => {
    const response = await POST('/api/chat', {
      messages: [{ role: 'user', content: 'https://youtube.com/watch?v=123' }]
    })
    expect(response.tools).toContain('create_task')
  })
})
```

### 9.3 E2E Tests

- Test complete user flows
- Verify tool calling in production
- Test error scenarios and edge cases

---

## 10. Monitoring & Observability

### 10.1 Metrics to Track

- Tool call frequency and success rates
- Token usage per tool call
- Response times for different tools
- Error rates and types

### 10.2 Logging Strategy

```typescript
// Structured logging in tools
const logger = createLogger({ service: 'chat-tools' })

export const get_task_status = {
  execute: async ({ taskId }) => {
    logger.info('get_task_status called', { taskId, userId: user.id })
    try {
      const result = await fetchTaskStatus(taskId)
      logger.info('get_task_status success', { taskId, status: result.status })
      return result
    } catch (error) {
      logger.error('get_task_status failed', { taskId, error: error.message })
      throw error
    }
  }
}
```

---

## 11. Future Enhancements

### 11.1 Advanced Tools

- **Export Tools**: PDF, Markdown, JSON export
- **Analytics Tools**: Usage statistics, insights
- **Admin Tools**: User management, system health
- **Integration Tools**: Third-party service connections

### 11.2 Multi-Modal Support

- **Image Analysis**: Screenshot analysis tools
- **Audio Processing**: Audio-only content tools
- **Document Processing**: PDF/Document summarization tools

### 11.3 AI Model Upgrades

- **Model Switching**: Dynamic model selection
- **Fine-tuning**: Custom model training
- **Local Models**: On-premise model support

---

## 12. Conclusion

This architecture provides a **clean, maintainable, and extensible** foundation for VibeDigest's chat functionality. By leveraging **Vercel AI SDK + Tool Calling**, we avoid the complexity of LangGraph while maintaining powerful capabilities for task management and content retrieval.

The **tool-based design** ensures that new features can be added easily without architectural changes, and the **clear separation of concerns** makes the system easier to debug and maintain.

**Next Steps**: Begin with Phase 1 implementation and iterate based on user feedback and performance metrics.