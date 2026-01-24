# Chat Module Redesign Plan

## Goal
Transform the Task Detail page into a split-view workspace with Chat as a first-class citizen, inspired by AnyGen's interface.

## Architecture

### Desktop Layout (≥768px)
```
┌─────────────────────────────────────────────┬──────────────────────┐
│ Video/Content Panel (Left)                 │ Chat Panel (Right)   │
│ - Video Player                              │ - AssistantChat      │
│ - Summary/Script/MindMap Tabs              │ - Thread History     │
│ - Keypoints Timeline                        │ - Message Stream     │
│                                             │ - Input Box          │
│ [Toggle Chat Button in Header]             │ [Collapsible]        │
└─────────────────────────────────────────────┴──────────────────────┘
```

### Mobile Layout (<768px)
```
┌─────────────────────────────────────────────┐
│ Video/Content Panel                         │
│ Tabs: Summary | MindMap | Script | **Chat** │
└─────────────────────────────────────────────┘
```

## Implementation Steps

### 1. ✅ Refactor AssistantChat Component
- [x] Add props: `className`, `defaultSidebarOpen`, `minimal`
- [x] Support embedded mode (can hide internal sidebar)
- [x] Make it composable for split-view layout

### 2. 🚧 Update TaskDetailClient
- [x] Add state: `isChatOpen`, `isMobile`
- [ ] Restructure return JSX:
  - Main container: `flex flex-col md:flex-row`
  - Left panel: Content (flex-1)
  - Right panel: Chat sidebar (conditional, collapsible)
- [ ] Add "Chat" tab to mobile TabsList
- [ ] Add chat toggle button to header (desktop)

### 3. ⏳ Polish & Test
- [ ] Responsive breakpoints
- [ ] Animation transitions
- [ ] Keyboard shortcuts (Cmd+K to toggle chat)
- [ ] Persist chat state (localStorage)

## File Changes
- ✅ `frontend/src/components/chat/AssistantChat.tsx`
- 🚧 `frontend/src/app/[lang]/(main)/tasks/[id]/[slug]/TaskDetailClient.tsx`

## Current Status
Working on Task 2: Implementing split-view layout in TaskDetailClient.
