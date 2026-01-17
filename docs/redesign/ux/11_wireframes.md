# Wireframes

> **Purpose**: Visual layout mockups using ASCII art  
> **Audience**: Designers, Frontend Developers  
> **Last Updated**: 2025-01-18

---

## 🖥️ Desktop Wireframes (1920x1080)

### 1. Empty State - First Visit

```
┌──────────────────────────────────────────────────────────────────┐
│ ☰ Library    VibeDigest                            👤 User       │ ← Top Bar (64px)
├─────────────────────────────┬────────────────────────────────────┤
│                             │                                    │
│   Chat Container (60%)      │   (Panel Hidden)                   │
│                             │                                    │
│  ┌─────────────────────┐    │                                    │
│  │  💬                  │    │                                    │
│  │  Paste a YouTube URL │    │                                    │
│  │  to get started...   │    │                                    │
│  │                      │    │                                    │
│  │  Example:            │    │                                    │
│  │  youtube.com/...     │    │                                    │
│  └─────────────────────┘    │                                    │
│                             │                                    │
│  ────── Community ──────    │                                    │
│                             │                                    │
│  ┌──────┐  ┌──────┐        │                                    │
│  │ 🎬   │  │ 🎬   │        │                                    │
│  │ Demo │  │ Demo │        │                                    │
│  │ #1   │  │ #2   │        │                                    │
│  └──────┘  └──────┘        │                                    │
│                             │                                    │
│                             │                                    │
│  ┌────────────────────┐     │                                    │
│  │ Type your message  │     │                                    │
│  │ or paste a URL...  │ 📎  │                                    │
│  └────────────────────┘ 📤  │                                    │
└─────────────────────────────┴────────────────────────────────────┘
```

---

### 2. Processing State - URL Submitted

```
┌──────────────────────────────────────────────────────────────────┐
│ ☰ Library    VibeDigest                            👤 User       │
├─────────────────────────────┬────────────────────────────────────┤
│                             │                                    │
│   ┌───────────────────┐     │   Video Detail Panel               │
│   │ User (1m ago)     │     │   (collapsed, animating in)        │
│   │ Summarize this:   │     │                                    │
│   │ youtube.com/abc   │     │                                    │
│   └───────────────────┘     │                                    │
│                             │                                    │
│   ┌───────────────────┐     │                                    │
│   │ AI (Just now)     │     │                                    │
│   │ ⏳ Processing...  │     │                                    │
│   │                   │     │                                    │
│   │ ┌───────────────┐ │     │                                    │
│   │ │ 📹 Video      │ │     │                                    │
│   │ │ [Thumbnail]   │ │     │                                    │
│   │ │               │ │     │                                    │
│   │ │ ⏸️ Transcribing│ │     │                                    │
│   │ │ Step 2/4      │ │     │                                    │
│   │ │ ████░░░░░░ 40%│ │     │                                    │
│   │ │               │ │     │                                    │
│   │ │ ~45s remaining│ │     │                                    │
│   │ └───────────────┘ │     │                                    │
│   └───────────────────┘     │                                    │
│                             │                                    │
│  ┌────────────────────┐     │                                    │
│  │ [Input disabled]   │ 🚫  │                                    │
│  └────────────────────┘     │                                    │
└─────────────────────────────┴────────────────────────────────────┘
```

---

### 3. Completed State - Panel Open

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰ Library    VibeDigest                                        👤 User      │
├──────────────────────────────┬───────────────────────────────────────────────┤
│                              │  [×] Close Panel                              │
│   ┌────────────────────┐     │  ┌─────────────────────────────────────────┐ │
│   │ User (2m ago)      │     │  │ 📹 Video Player                         │ │
│   │ Summarize this:    │     │  │ ▶️  [YouTube Embed]                     │ │
│   │ youtube.com/abc    │     │  │                                         │ │
│   └────────────────────┘     │  └─────────────────────────────────────────┘ │
│                              │                                               │
│   ┌────────────────────┐     │  ┌─────────────────────────────────────────┐ │
│   │ AI (1m ago)        │     │  │ [Summary] [Script] [MindMap]            │ │
│   │ ✅ Analysis ready! │────→│  └─────────────────────────────────────────┘ │
│   │                    │     │                                               │
│   │ ┌────────────────┐ │     │  📝 Overview                                 │
│   │ │ 📹 Video Title │ │     │  This video discusses...                     │
│   │ │ [View →]       │ │     │                                               │
│   │ └────────────────┘ │     │  ⚡ Key Points                               │
│   └────────────────────┘     │  • Point 1 [00:45] ────┐                     │
│                              │  • Point 2 [02:13]     │ Click to seek       │
│   ┌────────────────────┐     │  • Point 3 [05:30]     │                     │
│   │ User (Just now)    │     │                        │                     │
│   │ What was the main  │     │  📊 Classification      │                     │
│   │ conclusion?        │     │  Category: Tutorial    │                     │
│   └────────────────────┘     │  Structure: Sequential │                     │
│                              │                        │                     │
│  ┌───────────────────┐       │                        │                     │
│  │ Ask a question... │  📤   │                        │                     │
│  └───────────────────┘       │                        │                     │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

---

### 4. Library Sidebar Open

```
┌────────────┬─────────────────────────┬────────────────────────────────────────┐
│            │                         │                                        │
│  Library   │   Chat Container        │   Video Detail Panel                   │
│  (320px)   │   (flex-1)              │   (40%)                                │
│            │                         │                                        │
│ ┌────────┐ │                         │                                        │
│ │ 🔍     │ │   [Chat messages]       │   [Video + Summary]                    │
│ └────────┘ │                         │                                        │
│            │                         │                                        │
│ Recent     │                         │                                        │
│ ┌────────┐ │                         │                                        │
│ │ 📹 Vid1│ │                         │                                        │
│ │ 2h ago │←┼─ Click to load thread   │                                        │
│ └────────┘ │                         │                                        │
│ ┌────────┐ │                         │                                        │
│ │ 📹 Vid2│ │                         │                                        │
│ │ 1d ago │ │                         │                                        │
│ └────────┘ │                         │                                        │
│            │                         │                                        │
│ All Tasks  │                         │                                        │
│ ┌────────┐ │                         │                                        │
│ │ 📹 Vid3│ │                         │                                        │
│ │ 2d ago │ │                         │                                        │
│ └────────┘ │                         │                                        │
│ ┌────────┐ │                         │                                        │
│ │ 📹 Vid4│ │                         │                                        │
│ │ 1w ago │ │                         │                                        │
│ └────────┘ │                         │                                        │
│            │                         │                                        │
│ [Close ←]  │                         │                                        │
└────────────┴─────────────────────────┴────────────────────────────────────────┘
```

---

## 📱 Mobile Wireframes (375x667)

### 5. Mobile - Empty State

```
┌─────────────────────┐
│  ☰  VibeDigest  👤  │ ← Top Bar (56px)
├─────────────────────┤
│                     │
│  💬                 │
│  Paste a YouTube    │
│  URL to start...    │
│                     │
│  ──── Community ──  │
│                     │
│  ┌───────┬────────┐ │
│  │ 🎬    │ 🎬     │ │
│  │ Demo1 │ Demo2  │ │
│  └───────┴────────┘ │
│  ┌───────┬────────┐ │
│  │ 🎬    │ 🎬     │ │
│  │ Demo3 │ Demo4  │ │
│  └───────┴────────┘ │
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│ Type or paste URL   │ ← Fixed Input (56px)
│ 📎             📤   │
└─────────────────────┘
```

---

### 6. Mobile - Processing

```
┌─────────────────────┐
│  ☰  VibeDigest  👤  │
├─────────────────────┤
│ User (1m ago)       │
│ Summarize:          │
│ youtube.com/abc     │
│                     │
│ ┌─────────────────┐ │
│ │ AI (Just now)   │ │
│ │ ⏳ Processing...│ │
│ │                 │ │
│ │ ┌─────────────┐ │ │
│ │ │ 📹 Video    │ │ │
│ │ │ [Thumb]     │ │ │
│ │ │             │ │ │
│ │ │ Transcribing│ │ │
│ │ │ ████░░░░ 50%│ │ │
│ │ │ ~30s left   │ │ │
│ │ └─────────────┘ │ │
│ └─────────────────┘ │
│                     │
├─────────────────────┤
│ [Input disabled] 🚫 │
└─────────────────────┘
```

---

### 7. Mobile - Video Modal (Full Screen)

```
┌─────────────────────┐
│ [←] Video Detail    │ ← Modal Header
├─────────────────────┤
│ ┏━━━━━━━━━━━━━━━━━┓ │
│ ┃ 📹 Video Player ┃ │
│ ┃ ▶️  [Embed]     ┃ │
│ ┃                 ┃ │
│ ┗━━━━━━━━━━━━━━━━━┛ │
│                     │
│ [Summary][Script]   │ ← Tabs
│                     │
│ 📝 Overview         │
│ This video...       │
│                     │
│ ⚡ Key Points       │
│ • Point 1 [00:45]   │
│ • Point 2 [02:13]   │
│                     │
│ (Scrollable)        │
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│ Ask about video...  │ ← Input stays visible
│              📤     │
└─────────────────────┘
```

---

### 8. Mobile - Library Drawer

```
┌─────────────────────┐
│  [×]  Library       │ ← Drawer Header
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ 🔍 Search...    │ │
│ └─────────────────┘ │
│                     │
│ Recent              │
│ ┌─────────────────┐ │
│ │ 📹 Video Title  │ │
│ │ 2h ago          │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ 📹 Video Title  │ │
│ │ 1d ago          │ │
│ └─────────────────┘ │
│                     │
│ All Tasks           │
│ ┌─────────────────┐ │
│ │ 📹 Video Title  │ │
│ │ 2d ago          │ │
│ └─────────────────┘ │
│                     │
│ (Scrollable)        │
│                     │
│                     │
└─────────────────────┘
```

---

## 🎯 Component Annotations

### Chat Message Types

**User Message**:
```
┌───────────────────┐
│ User (timestamp)  │ ← Metadata
│ Message text...   │ ← Content
└───────────────────┘
```

**AI Text Message**:
```
┌───────────────────┐
│ AI (timestamp)    │
│ Response text...  │
│ [Markdown support]│
└───────────────────┘
```

**AI Video Card**:
```
┌───────────────────┐
│ AI (timestamp)    │
│ ┌───────────────┐ │
│ │ 📹 Title      │ │
│ │ [Thumbnail]   │ │
│ │               │ │
│ │ Status/CTA    │ │
│ └───────────────┘ │
└───────────────────┘
```

---

## ✅ Wireframe Validation

**Each wireframe should show**:
- [ ] Clear hierarchy (what's most important)
- [ ] All interactive elements (buttons, inputs)
- [ ] States (empty, loading, success, error)
- [ ] Responsive behavior (desktop vs mobile)
- [ ] Dimensions (px or %)

**Next**: See `specifications/20_component_specs.md` for technical implementation details.
