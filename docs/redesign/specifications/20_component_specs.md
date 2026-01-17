# Component Specifications

> **Purpose**: Technical specs for all new/refactored components  
> **Audience**: Coding Agents, Frontend Developers  
> **Format**: TypeScript interfaces + Implementation examples  
> **Last Updated**: 2025-01-18

---

## ⚠️ Critical Dependency: AI SDK v6

**IMPORTANT**: This project uses **AI SDK v6** (Vercel AI SDK). All implementations MUST use v6 APIs.

```bash
npm install ai@^4.0.0 @ai-sdk/react@^1.0.0
```

**v6 Import Pattern**:
```typescript
import { useChat } from '@ai-sdk/react'
```

---

## 📦 Component Hierarchy

```
ChatWorkspace (Root Container)
├── IconSidebar (Left - Fixed)
│   ├── ThemeToggle
│   ├── UserMenu
│   └── FeedbackDialog
│
├── ChatContainer (Center - Flex)
│   ├── ChatHeader (Status)
│   ├── ChatMessages
│   │   ├── TextMessage
│   │   └── VideoCardMessage (Progress/Status)
│   └── ChatInput (Floating Capsule)
│
├── VideoDetailPanel (Right - Collapsible)
│   ├── VideoPlayer (Glass Card)
│   ├── SummarySection (Structured)
│   │   ├── InsightCards
│   │   ├── ActionItems
│   │   └── Risks
│   └── ScriptTimeline (Tab)
│
└── LibrarySidebar (Drawer)
```

---

## 1. IconSidebar

**File Path**: `frontend/src/components/chat/IconSidebar.tsx`

### Purpose
Fixed left navigation bar. Handles theme toggling, new chat, and library access.

### Props
```typescript
interface IconSidebarProps {
  onOpenLibrary: () => void
  onNewChat: () => void
}
```

---

## 2. ChatWorkspace

**File Path**: `frontend/src/components/chat/ChatWorkspace.tsx`

### Purpose
Layout orchestrator. Manages the 3-column grid and mobile responsiveness.

### Implementation Notes
- **Desktop**: 3 columns (IconSidebar | Chat | ContextPanel)
- **Mobile**: Stack (Chat covers screen; ContextPanel is a Sheet)
- **State**: Tracks `activeTaskId` via URL param `?task=...`

---

## 3. VideoDetailPanel (Context Panel)

**File Path**: `frontend/src/components/chat/VideoDetailPanel.tsx`

### Purpose
Displays video content and structured AI insights.

### Type Definition (v2 Schema)
```typescript
type StructuredSummaryV2 = {
    overview: string
    keypoints: Array<{
        title: string
        detail: string
        startSeconds?: number
    }>
    action_items?: Array<{
        content: string
        priority?: 'high' | 'medium' | 'low'
    }>
    risks?: Array<{
        content: string
        severity?: 'high' | 'medium' | 'low'
    }>
}
```

### UI Components
- **VideoPlayer**: Custom glassmorphic card wrapping YouTube/Bilibili embed.
- **Insight Cards**: Gradient glass cards (`glass-card-active`).
- **Action/Risk Lists**: Styled lists with icons (CheckCircle, AlertTriangle).

---

## 4. ChatContainer

**File Path**: `frontend/src/components/chat/ChatContainer.tsx`

### Purpose
Main chat interface. Uses `useChat` hook.

### Key Logic
- **URL Detection**: Regex checks for YouTube/Bilibili links.
- **Task Creation**: Calls `/api/process-video` proxy.
- **Context Injection**: Passes `taskId` to `append()` so backend knows context.
- **Video Card**: Renders `VideoCardMessage` when a task is tracked.

---

## 5. LibrarySidebar

**File Path**: `frontend/src/components/chat/LibrarySidebar.tsx`

### Purpose
Slide-out drawer for task history.

### Styling
- **Light**: `bg-white/80` backdrop blur.
- **Dark**: `bg-black/80` backdrop blur.
