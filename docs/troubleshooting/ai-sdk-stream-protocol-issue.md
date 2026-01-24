# AI SDK 流式响应问题诊断与解决

> 日期: 2026-01-17  
> 问题分类: AI SDK 集成 / 流协议兼容性

---

## 问题现象

前端发送消息后，**AI 响应无法显示**在聊天界面中：
- 服务端返回 `200 OK` 和 `text/event-stream`
- 前端 `messages` 数组只有 `user` 消息，没有 `assistant` 消息
- 控制台报错 `Type validation failed`，显示收到了 `text_completion` 格式

## 根本原因

**OpenAI API 协议版本不匹配**

| 组件 | 使用的 API | 调用端点 |
|-----|-----------|---------|
| AI SDK 默认 (`openai(model)`) | Responses API | `/v1/responses` |
| 前端 `useChat` 期望 | UI Message Stream | SSE 格式 |
| 自建 LLM 后端 | 混合支持 | 流式正确，非流式返回 `text_completion` |

**详细问题链**：
1. AI SDK v5+ 默认使用 **Responses API** (`/v1/responses`)
2. 自建 LLM 后端虽然支持 Responses API 流式格式，但在某些边界情况返回 `text_completion` 格式
3. 前端 `@ai-sdk/react` 的 `useChat` 无法正确解析混合格式，导致 `assistant` 消息丢失

## 解决方案

**改用 Chat Completions API**：

```typescript
// 修改前（使用 Responses API）
const result = streamText({
    model: openai(MODEL_NAME),  // 默认调用 /v1/responses
    ...
});

// 修改后（使用 Chat Completions API）
const result = streamText({
    model: openai.chat(MODEL_NAME),  // 显式调用 /v1/chat/completions
    ...
});
```

## 关键知识点

### AI SDK v5/v6 的两种 API 模式

| 模式 | 调用方式 | 端点 | 适用场景 |
|-----|---------|-----|---------|
| **Responses API** | `openai(model)` | `/v1/responses` | OpenAI 官方 API（推荐） |
| **Chat Completions API** | `openai.chat(model)` | `/v1/chat/completions` | 第三方兼容服务、自建 LLM |

### 后端返回方法对应关系

| 方法 | 适用前端 | 格式 |
|-----|---------|-----|
| `toUIMessageStreamResponse()` | `useChat` / `useChatRuntime` | UI Message Stream (SSE) |
| `toTextStreamResponse()` | 自定义处理 | 纯文本流 |

## 调试技巧

### 添加 fetch 日志查看请求详情

```typescript
const debugFetch: typeof fetch = async (input, init) => {
    console.log('[AI SDK] Request URL:', url);
    console.log('[AI SDK] Request body:', init?.body);
    const response = await fetch(input, init);
    console.log('[AI SDK] Response status:', response.status);
    console.log('[AI SDK] Content-type:', response.headers.get('content-type'));
    return response;
};

const openai = createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    fetch: debugFetch,
});
```

### 使用 curl 单独测试 LLM 后端

```bash
# 测试 Chat Completions API
curl -sN -X POST "http://127.0.0.1:8045/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "model": "gemini-3-flash",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": true
  }'
```

## 相关文件

- `frontend/src/app/api/chat/route.ts` - API 路由
- `frontend/src/components/chat/AssistantChat.tsx` - 聊天组件

## 参考链接

- [AI SDK OpenAI Provider 文档](https://sdk.vercel.ai/providers/ai-sdk-providers/openai)
- [OpenAI Responses API vs Chat Completions API](https://platform.openai.com/docs/guides/responses-vs-chat-completions)
