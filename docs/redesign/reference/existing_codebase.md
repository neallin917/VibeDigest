# Existing Codebase Analysis

> **Purpose**: Understand the current architecture before refactoring  
> **Target Audience**: Coding Agents, Developers  
> **Last Updated**: 2025-01-18

---

## 🎯 Overview

This document analyzes the **current (v1.x) architecture** to help identify:
- What can be **reused** in v2.0
- What needs to be **refactored**
- What should be **deprecated**

---

## 📂 Current Directory Structure

```
frontend/src/
├── app/[lang]/
│   ├── (main)/                       ← Protected route group
│   │   ├── dashboard/                ✅ Keep (transform to chat)
│   │   ├── history/                  ❌ Deprecated (merge to Library)
│   │   ├── tasks/[id]/[slug]/        ❌ Deprecated (use chat + panel)
│   │   └── settings/                 ✅ Keep
│   ├── chat/                         ✅ Keep (redesign as main page)
│   ├── login/                        ✅ Keep
│   └── page.tsx                      ✅ Keep (landing)
│
├── components/
│   ├── chat/
│   │   └── AssistantChat.tsx         🔄 Refactor (add panel integration)
│   ├── dashboard/
│   │   ├── TaskForm.tsx              🔄 Move to chat input
│   │   └── CommunityTemplates.tsx    ✅ Reuse (for empty state)
│   ├── tasks/
│   │   ├── VideoEmbed.tsx            ✅ Reuse (extract to shared)
│   │   ├── AudioEmbed.tsx            ✅ Reuse
│   │   └── TranscriptTimeline.tsx    ✅ Reuse
│   └── layout/
│       ├── Sidebar.tsx               🔄 Refactor (add Library trigger)
│       └── MobileNav.tsx             ✅ Keep
│
└── lib/
    ├── api.ts                        🔄 Extend (add chat endpoints)
    └── supabase.ts                   ✅ Keep
```

---

## 🔍 Key Components Analysis

### 1. **TaskDetailClient** (Current Task Page)

**Location**: `src/app/[lang]/(main)/tasks/[id]/[slug]/TaskDetailClient.tsx`

**Current Responsibilities**:
- Fetch task data from Supabase
- Display video player (YouTube/Bilibili/Audio)
- Show Summary/Script/MindMap tabs
- Handle seekable playback
- Realtime task updates

**Reusability Assessment**:
| Component Part | Reusable? | Action |
|----------------|-----------|--------|
| Video player logic | ✅ Yes | Extract to `<VideoPlayer>` |
| Summary rendering | ✅ Yes | Extract to `<SummarySection>` |
| Script timeline | ✅ Yes | Already separate component |
| Tab navigation | ❌ No | Redesign for panel context |
| Layout container | ❌ No | Replace with `<VideoDetailPanel>` |

**Extraction Plan**:
```typescript
// Before (monolithic)
TaskDetailClient.tsx (1000+ lines)

// After (modular)
<VideoDetailPanel>
  <VideoPlayer />          ← Extracted
  <SummarySection />       ← Extracted
  <ScriptTimeline />       ← Already exists
  <MindMapView />          ← Extracted
</VideoDetailPanel>
```

---

### 2. **AssistantChat** (Current Chat Component)

**Location**: `src/components/chat/AssistantChat.tsx`

**Current Features**:
- Thread management (sidebar with thread list)
- Message display (user + assistant)
- AI SDK integration (`useChat` hook)
- Thread switching

**Issues**:
- Tightly coupled to standalone `/chat` page
- Sidebar always visible (not embeddable)
- No integration with task processing

**Refactor Plan**:
```typescript
// Current props
interface AssistantChatProps {
  taskId?: string
  defaultSidebarOpen?: boolean
  className?: string
  minimal?: boolean
}

// NEW: Add video panel integration
interface AssistantChatProps {
  taskId?: string
  onTaskCreated?: (taskId: string) => void  // NEW: Notify parent
  onMessageWithURL?: (url: string) => void  // NEW: Handle URLs
  hideThreadSidebar?: boolean               // NEW: For embedded mode
}
```

---

### 3. **CommunityTemplates** (Demo Cards)

**Location**: `src/components/dashboard/CommunityTemplates.tsx`

**Current Features**:
- Fetches tasks where `is_demo = true`
- Displays as grid of cards
- Click → Navigate to task detail page

**Reuse Strategy**:
```typescript
// Current usage (Dashboard)
<CommunityTemplates />

// New usage (Chat empty state)
<ChatWorkspace>
  {messages.length === 0 && (
    <div className="empty-state">
      <h2>Get Started</h2>
      <p>Paste a YouTube URL above...</p>
      <CommunityTemplates 
        onTaskClick={(task) => openInPanel(task)}  // NEW: Open in panel
      />
    </div>
  )}
</ChatWorkspace>
```

---

### 4. **Database Schema (Current)**

**Relevant Tables**:

```sql
-- tasks table (unchanged)
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  video_url TEXT NOT NULL,
  video_title TEXT,
  thumbnail_url TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INT DEFAULT 0,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_threads table (needs extension)
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- chat_messages table (OK as-is)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Required Change**:
```sql
-- ADD: Link threads to tasks
ALTER TABLE chat_threads 
ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_threads_task_id ON chat_threads(task_id);
```

---

## 🔄 Migration Considerations

### Existing User Data

**Scenario**: Users with existing tasks (no threads)

**Solution**: Create "placeholder" threads for historical tasks

```sql
-- Migration script (to be executed once)
INSERT INTO chat_threads (id, user_id, task_id, title, created_at)
SELECT 
  gen_random_uuid(),
  user_id,
  id AS task_id,
  video_title AS title,
  created_at
FROM tasks
WHERE id NOT IN (SELECT task_id FROM chat_threads WHERE task_id IS NOT NULL);
```

### URL Redirects

**Old URLs**:
```
/en/tasks/abc-123/video-title
/en/history
```

**New Behavior**:
```
/en/tasks/abc-123/video-title  →  Redirect to /en/chat?task=abc-123
/en/history                    →  Redirect to /en/chat (Library sidebar auto-opens)
```

---

## 🚨 Breaking Changes

### Removed Pages
- ❌ `/dashboard` → Replaced by `/chat`
- ❌ `/history` → Replaced by Library sidebar
- ❌ `/tasks/[id]/[slug]` → Replaced by chat + panel

### Removed Components
- ❌ `TaskList.tsx` (History page) → Replaced by `LibrarySidebar`
- ❌ `TaskCard.tsx` (separate card component) → Merged into Library

### Behavior Changes
- **Before**: Submit URL → Wait on task list → Click to view
- **After**: Paste URL in chat → AI processes → Panel opens automatically

---

## ✅ Validation Checklist (Before Refactor)

Before starting the redesign, verify:

- [ ] All current E2E tests pass (`npm run test:e2e`)
- [ ] Database has recent backup
- [ ] Document all custom hooks used in TaskDetailClient
- [ ] List all Supabase queries that need updating
- [ ] Identify all API routes that reference `/tasks/[id]`

**Next Step**: Proceed to `reference/decisions.md` to understand design rationale.
