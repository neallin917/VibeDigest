# AI SDK v6 Migration Pitfalls & Solutions

Date: 2026-01-19
Context: Refactoring Chat Module to AI SDK v6

We encountered several breaking changes and "gotchas" when upgrading to / using AI SDK v6 (`@ai-sdk/react` + `ai`).

## 1. Submission: `append` vs `sendMessage`

**Issue**: The `append` method in `useChat` caused inconsistent behavior (missing IDs, structure mismatches) and is less stable in v6.
**Solution**: Use `sendMessage` for programmatic submission.

```typescript
// ❌ Avoid
append({ role: 'user', content: '...' });

// ✅ Recommended
const { sendMessage } = useChat();
sendMessage(...);
```

## 2. Message Payload Structure

**Issue**: `sendMessage('string')` is deprecated or behaves incorrectly in some adapters. Additionally, sending just `{ content: '...' }` can cause server-side errors if the backend expects `parts`.

**Solution**: Always pass a full message object. For maximum compatibility with `convertToModelMessages` on the backend, send `parts`.

```typescript
// ❌ Potentially problematic
sendMessage('Hello');

// ✅ Robust v6 usage
sendMessage({
  role: 'user',
  parts: [{ type: 'text', text: 'Hello' }],
});
```

## 3. Server-Side: `convertToModelMessages` Error

**Error**: `TypeError: Cannot read properties of undefined (reading 'map')` inside `convertToModelMessages`.
**Cause**: The client sent a message with `content` string but no `parts` array, and the v6 converter tried to map over `parts`.
**Fix**: See point #2 - ensure client sends `parts`.

## 4. Stream Protocol Mismatch

**Issue**: The frontend `useChat` hook connects but messages never appear in the list, even though the network request succeeds (200 OK).
**Cause**: The API route was returning `toTextStreamResponse()` (plain text). `useChat` v6 expects a specific stream data protocol.
**Fix**: Use `toUIMessageStreamResponse()` (or `toDataStreamResponse()` in newer distinct versions) in the route handler.

```typescript
// src/app/api/chat/route.ts

// ❌ Plain text stream - Frontend won't parse
return result.toTextStreamResponse();

// ✅ UI Message Stream - Frontend updates correctly
return result.toUIMessageStreamResponse();
```

## 5. Rendering Message Content

**Issue**: `message.content` can be unreliable or undefined for multi-part messages (e.g. reasoning + text).
**Solution**: Render from `message.parts` using a helper.

```typescript
function getText(message: any) {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((p: any) => p?.type === 'text')
      .map((p: any) => p.text)
      .join('');
  }
  return message.content || '';
}

// Usage
<div>{getText(m)}</div>
```
