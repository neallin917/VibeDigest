# Architecture Decisions Record (ADR)

> **Purpose**: Document key design decisions and their rationale  
> **Format**: Each decision includes Context, Options Considered, Decision, Consequences  
> **Last Updated**: 2025-01-18

---

## Decision Log

### ADR-001: Split-Screen Layout (60/40 Fixed Ratio)

**Status**: ✅ Accepted  
**Date**: 2025-01-18  
**Deciders**: Product Team

**Context**:
User needs to simultaneously view chat conversation and video content. We evaluated different layout approaches.

**Options Considered**:
1. **Fixed 60/40**: Chat占60%，Video Panel占40%
2. **Resizable**: 用户可拖拽调整比例
3. **Preset Layouts**: 提供3个预设（50/50, 60/40, 70/30）

**Decision**: Option 1 (Fixed 60/40)

**Rationale**:
- Simplifies initial implementation (no drag logic needed)
- 60/40 ratio tested well in similar tools (Perplexity, Notion AI)
- Reduces edge cases (min/max width handling)
- Can upgrade to resizable in v2.1 if needed

**Consequences**:
- ✅ Faster development
- ✅ Consistent UX across users
- ❌ Less flexibility for power users
- ⚠️ May need adjustment based on user feedback

---

### ADR-002: Component Extraction Strategy

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
`TaskDetailClient.tsx` is 1000+ lines and tightly coupled to the standalone task page. We need to reuse video display logic in the chat panel.

**Options Considered**:
1. **Duplicate Code**: Copy-paste logic into new `VideoDetailPanel`
2. **Extract Shared Components**: Break `TaskDetailClient` into reusable pieces
3. **Wrapper Component**: Keep `TaskDetailClient` as-is, wrap it in panel

**Decision**: Option 2 (Extract Shared Components)

**Rationale**:
- Adheres to DRY principle
- Makes components testable in isolation
- Easier to maintain (single source of truth)
- Follows React best practices

**Extraction Plan**:
```
TaskDetailClient (monolith)
  ↓
  ├── VideoPlayer (extract)
  ├── SummarySection (extract)
  ├── ScriptTimeline (already exists)
  └── MindMapView (extract)
```

**Consequences**:
- ✅ Reusable components across app
- ✅ Easier unit testing
- ❌ Requires refactoring existing code
- ⚠️ Risk of breaking current task page (mitigated by tests)

---

### ADR-003: Thread-Task Relationship (1:1 Model)

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
Need to decide how chat threads relate to video tasks.

**Options Considered**:
1. **1:1**: One Thread = One Task (focused conversations)
2. **1:N**: One Thread can contain multiple Tasks (comparison mode)

**Decision**: Option 1 (1:1 Model)

**Rationale**:
- Simpler mental model for users
- Easier to implement (straightforward FK relationship)
- Aligns with "Chat about a specific video" UX
- Can extend to 1:N later if comparison feature is needed

**Database Design**:
```sql
ALTER TABLE chat_threads 
ADD COLUMN task_id UUID REFERENCES tasks(id);

-- Optional: Enforce uniqueness
CREATE UNIQUE INDEX idx_chat_threads_task_id_unique 
ON chat_threads(task_id) WHERE task_id IS NOT NULL;
```

**Consequences**:
- ✅ Clear context (each conversation is about one video)
- ✅ Simple data model
- ❌ Users can't compare multiple videos in one chat (can add later)

---

### ADR-004: Library UI (Simple List)

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
Library sidebar needs to show user's processed videos.

**Options Considered**:
1. **Simple List**: Title + timestamp
2. **Grouped List**: Group by date (Today, Yesterday, etc.)
3. **Rich Cards**: Thumbnail + title + summary preview

**Decision**: Option 1 (Simple List) for MVP

**Rationale**:
- Minimalist design matches chat-first UX
- Fast to implement
- Low cognitive load (focuses on titles)
- Can upgrade to grouped/rich view later

**Future Enhancement Path**:
```
v2.0: Simple list (title + time)
  ↓
v2.1: Add date grouping
  ↓
v2.2: Add thumbnail preview
  ↓
v2.3: Add tag filtering
```

**Consequences**:
- ✅ Clean, fast interface
- ✅ Easy to scan long lists
- ❌ Less visual (no thumbnails)
- ⚠️ May need search for power users with 100+ tasks

---

### ADR-005: Mobile UX (Modal/Drawer Pattern)

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
Mobile screens (<768px) can't fit split-screen layout.

**Options Considered**:
1. **Stack Layout**: Chat on top, scroll to video details below
2. **Tab Switching**: [Chat] [Video] tabs
3. **Modal/Drawer**: Chat as main view, video details in modal

**Decision**: Option 3 (Modal/Drawer)

**Rationale**:
- Follows mobile design standards (iOS/Android patterns)
- Clear hierarchy (chat is primary, video is secondary)
- No accidental scrolling issues
- Easy to dismiss (swipe down to close)

**Implementation**:
```tsx
// Desktop (≥768px)
<div className="flex">
  <ChatContainer />
  <VideoDetailPanel />
</div>

// Mobile (<768px)
<div>
  <ChatContainer />
  <Sheet open={isVideoOpen}>
    <VideoDetailPanel />
  </Sheet>
</div>
```

**Consequences**:
- ✅ Native mobile feel
- ✅ Consistent with other mobile apps
- ❌ Requires managing modal state
- ⚠️ Need smooth animations for good UX

---

### ADR-006: Empty State Design (Guidance + Demo Cards)

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
When user first opens chat (no messages), we need to guide them.

**Options Considered**:
1. **Blank Canvas**: Just input box, no guidance
2. **Onboarding Tutorial**: 3-step walkthrough
3. **Guidance + Examples**: Text prompt + demo cards

**Decision**: Option 3 (Guidance + Examples)

**Rationale**:
- Balances simplicity and discoverability
- Reuses existing `CommunityTemplates` component
- Shows product value immediately (via demos)
- Non-intrusive (no forced tutorial)

**Design**:
```
┌─────────────────────────────────┐
│  Paste a YouTube URL to start   │
│  Example: https://youtu.be/...  │
│                                 │
│  ────── Community Examples ──── │
│  [Demo Card 1] [Demo Card 2]    │
│  [Demo Card 3] [Demo Card 4]    │
└─────────────────────────────────┘
```

**Consequences**:
- ✅ Clear call-to-action
- ✅ Showcases product capabilities
- ✅ Reduces bounce rate (engagement hook)
- ❌ Slightly more visual noise

---

### ADR-007: Multi-URL Handling Strategy

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
Users may paste multiple YouTube URLs in a single message. We need to define how the system handles this scenario.

**Options Considered**:
1. **Process All Simultaneously**: Create multiple tasks in parallel
2. **Process Separately**: Create multiple threads, one per URL
3. **Ask User to Choose One**: Only allow one URL per thread

**Decision**: Option 3 (One URL Per Thread)

**Rationale**:
- Enforces clear context (one conversation = one video)
- Prevents confusion in chat history
- Aligns with 1:1 Thread-Task relationship (ADR-003)
- Simpler implementation (no batch processing logic)
- Users can create multiple threads if needed

**User Experience**:
When multiple URLs detected:
```
┌────────────────────────────────────┐
│ ⚠️  Multiple URLs Detected         │
│                                    │
│ I can only process one video per   │
│ conversation. Which one would you  │
│ like me to analyze?                │
│                                    │
│ 1️⃣ https://youtube.com/watch?v=A  │
│ 2️⃣ https://youtube.com/watch?v=B  │
│                                    │
│ Reply with 1 or 2, or paste a      │
│ single URL to start fresh.         │
└────────────────────────────────────┘
```

**Consequences**:
- ✅ Clear, predictable behavior
- ✅ No ambiguity in chat context
- ✅ Simpler state management
- ❌ Users must create separate threads for multiple videos (acceptable)

---

### ADR-008: AI Tool Calling Implementation

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
Need to integrate video processing into chat workflow.

**Options Considered**:
1. **Vercel AI SDK Tools**: Use built-in `tools` parameter
2. **Custom Function Calling**: Parse messages manually
3. **Hybrid**: AI SDK for parsing, custom for execution

**Decision**: Option 1 (Vercel AI SDK Tools)

**Rationale**:
- Native support in AI SDK (`useChat` hook)
- Handles streaming automatically
- Standard interface (easier for future LLM swaps)
- Well-documented patterns

**Implementation**:
```typescript
const { messages } = useChat({
  api: '/api/chat',
  tools: {
    process_video: {
      description: 'Process a YouTube video',
      parameters: z.object({
        video_url: z.string().url(),
        language: z.string().optional(),
      }),
      execute: async ({ video_url, language }) => {
        // Call backend /api/process-video
        return { task_id, status }
      }
    }
  }
})
```

**Consequences**:
- ✅ Leverages existing infrastructure
- ✅ Future-proof (tool calling is LLM standard)
- ❌ Tied to AI SDK (but acceptable trade-off)

---

### ADR-009: 3-Column Layout & Dual Theme

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
User requested a more polished, "wow" factor design, providing an HTML draft with a distinct Glassmorphic Light theme and a 3-column structure.

**Options Considered**:
1. **Stick to 60/40 Dark Mode**: Conservative, safe.
2. **Pivot to 3-Column Glassmorphism**: High visual impact, better navigation.

**Decision**: Option 2 (3-Column Layout + Dual Theme Support)

**Rationale**:
- **3-Column**: Icon Sidebar (Nav) + Chat (Action) + Context Panel (Content) offers better separation of concerns than 2-column.
- **Dual Theme**: Supporting both "Frosty Morning" (Light Glass) and "Deep Space" (Dark Cyber) maximizes user appeal.
- **Glassmorphism**: Adds premium feel requested by user.

**Consequences**:
- ✅ Significantly improved aesthetics.
- ✅ Better navigation via Icon Sidebar.
- ❌ Higher CSS complexity (backdrop-blur, gradients).
- ❌ Need to maintain two distinct color palettes.

---

### ADR-010: Backend Schema v2 (Structured Intelligence)

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
The new UI design includes specific cards for "Action Items" and "Risks", but the backend only returned generic "Keypoints".

**Decision**: Upgrade LLM Prompts to Schema v2

**Schema Changes**:
```json
{
  "keypoints": [...],
  "action_items": [{ "content": "...", "priority": "high" }],
  "risks": [{ "content": "...", "severity": "medium" }]
}
```

**Rationale**:
- **Actionable**: Moving from passive summary to active advice.
- **Structured**: Allows rich UI rendering (icons, color coding) rather than flat markdown text.

**Consequences**:
- ✅ Richer, more useful output.
- ✅ UI matches data perfectly.
- ⚠️ LLM prompt is more complex, potentially higher latency or token cost.

---

### ADR-011: Legacy Cleanup Strategy

**Status**: ✅ Accepted  
**Date**: 2025-01-18

**Context**:
With the new Chat-First interface active, the old `/tasks/[id]` page and `TaskDetailClient` component were redundant.

**Decision**: Deprecate and Redirect

1. **Redirect**: `/tasks/[id]/[slug]` -> `/chat?task=[id]`
2. **Delete**: `TaskDetailClient.tsx`, `AssistantChat.tsx`
3. **Update**: Dashboard links point directly to Chat.

**Rationale**:
- Reduces technical debt.
- Prevents split user experience (old vs new views).
- Focuses all development effort on the new Chat UI.

**Consequences**:
- ✅ Leaner codebase.
- ✅ Unified UX.
- ❌ SEO implications for old task URLs (mitigated by 307 Redirects).

---

## Open Questions

**Q1**: How to handle Library pagination for users with 500+ tasks?  
**Status**: ⏳ Pending  
**Options**: Infinite scroll vs. Load more button vs. Virtual scrolling

**Q2**: Should we preserve the standalone `/tasks/[id]` page for SEO/sharing?  
**Status**: ⏳ Pending  
**Impact**: Old links break vs. Maintain two views

**Q3**: Should we add "Compare Videos" feature in future?  
**Status**: ⏳ Pending  
**Note**: Currently enforcing one URL per thread. If users request comparison, we could add a dedicated "Compare" mode in v2.1

---

## Future Decisions (Post-MVP)

- **Keyboard Shortcuts**: Define comprehensive shortcut map (Cmd+K, Cmd+/, etc.)
- **Drag-to-Resize**: Add resizable panel divider
- **Offline Support**: Handle disconnected state gracefully
- **Voice Input**: Allow voice-to-text for chat input

---

## Decision Review Process

**When to Update This Document**:
- Before implementing any major architectural change
- When user feedback contradicts a decision
- When technical constraints invalidate an option

**Review Frequency**: Monthly or after each major release

**Last Reviewed**: 2025-01-18
