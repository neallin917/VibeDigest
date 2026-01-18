# 🔧 Context & Tool Calling Fix

> **Date**: 2026-01-18  
> **Purpose**: Fix "no context" issue in AI SDK chat implementation

---

## 🎯 Problem Identified

用户反馈："我刚尝试问了几个问题 我感觉他现在是完全没有上下文的"

**Root Cause**: 虽然我们实现了工具，但 AI 没有被鼓励主动使用它们来获取上下文。

---

## 🛠️ Fixes Applied

### 1. **Enhanced System Prompt**
```typescript
// BEFORE - 被动的工具描述
systemPrompt = `You have access to tools that can:
- Check task processing status (get_task_status)
- Retrieve processed content (get_task_outputs) 
...`

// AFTER - 主动的工具指导
systemPrompt = `IMPORTANT: You MUST use tools proactively to provide accurate, up-to-date information.

When a taskId is provided:
- ALWAYS call get_task_status first to check current progress
- If processing is complete, call get_task_outputs to retrieve the transcript and summary
- Use this real data to answer questions about the video content

Never make up information about video content. Always use tools to get real data before answering.`
```

### 2. **Added ToolChoice Auto**
```typescript
const result = streamText({
    model: openai.chat(MODEL_NAME),
    system: systemPrompt,
    messages: messagesWithTools,
    toolChoice: 'auto', // ✅ NEW: Let AI decide when to use tools
    tools: { ... }
});
```

### 3. **Proactive Task Context Injection**
```typescript
// ✅ NEW: When taskId provided, inject explicit tool instruction
const messagesWithTools = taskId ? [
    ...coreMessages,
    {
        role: 'system' as const,
        content: `IMPORTANT: The user is asking about task ${taskId}. 
Before answering, you MUST:
1. Call get_task_status to check current progress
2. If completed, call get_task_outputs to get the transcript and summary
3. Use this real data to answer their question

Do not make assumptions about the content - use the tools!`
    }
] : coreMessages;
```

---

## 🔄 Expected Behavior Change

### Before Fix
- AI 等待用户明确要求才调用工具
- 没有上下文时给出泛泛回答
- 用户感觉 AI "没有上下文"

### After Fix  
- AI 被明确指示要主动使用工具
- 有 taskId 时自动查询状态和内容
- 基于真实数据回答，不是猜测

---

## 🧪 Testing Scenarios

### Scenario 1: User asks about existing task
```
User: "任务 abc-123 怎么样了？"
Expected AI Flow:
1. Calls get_task_status(taskId: "abc-123")
2. If completed, calls get_task_outputs(taskId: "abc-123")  
3. Answers based on real status and content
```

### Scenario 2: User provides video URL
```
User: "处理这个视频 https://youtube.com/watch?v=xxx"
Expected AI Flow:
1. Calls preview_video(url: "...")
2. Shows video metadata
3. Asks if user wants to proceed
4. If yes, calls create_task()
```

### Scenario 3: User asks general question about completed task
```
User: "这个视频讲了什么？"
Expected AI Flow:
1. Calls get_task_status() to confirm completion
2. Calls get_task_outputs() to get transcript/summary
3. Answers based on actual content
```

---

## 📋 Files Modified

1. **`frontend/src/app/api/chat/route.ts`**
   - ✅ Enhanced system prompt with proactive tool usage
   - ✅ Added `toolChoice: 'auto'`
   - ✅ Added task context injection when taskId provided

2. **Documentation Updated**
   - ✅ Updated migration status with context fix
   - ✅ Created this technical fix documentation

---

## 🚀 Next Steps for Testing

1. **Start Both Services**:
   ```bash
   # Backend
   cd backend && uv run main.py
   
   # Frontend  
   cd frontend && npm run dev
   ```

2. **Test Chat Scenarios**:
   - Ask about existing task status
   - Provide video URL and request processing
   - Ask questions about completed video content

3. **Verify Tool Calls**:
   - Check browser DevTools for tool execution
   - Check backend logs for tool calls
   - Verify responses contain real data

---

## 🎯 Success Metrics

### Expected Behavior
- ✅ AI proactively calls tools without being asked
- ✅ Responses contain real task data, not assumptions  
- ✅ User feels AI has full context
- ✅ No more "hallucinated" content

### Monitoring Points
```javascript
// Browser DevTools - Network Tab
// Look for these tool call patterns:
POST /api/chat 
{
  "messages": [...],
  "tools": {
    "get_task_status": {...},
    "get_task_outputs": {...}
  }
}
```

---

## 📞 Rollback Plan

If issues arise:
1. Remove `toolChoice: 'auto'`  
2. Revert system prompt to simpler version
3. Remove task context injection
4. Fall back to manual tool calling by user requests

---

**Status**: ✅ **READY FOR TESTING**

The "no context" issue should now be resolved. AI will proactively use tools to get real data about tasks and provide accurate, contextual responses.