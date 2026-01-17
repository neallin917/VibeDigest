# Design Principles

> **Purpose**: Define the core design philosophy for v2.0  
> **Audience**: Designers, Frontend Developers, Coding Agents  
> **Last Updated**: 2025-01-18

---

## 🎨 Core Principles

### 1. **Conversation-First**

**Principle**: All interactions should feel like a natural conversation, not a form submission.

**Implementation**:
- ✅ DO: Natural language input ("Summarize https://youtu.be/...")
- ❌ DON'T: Multi-step forms with dropdowns

**Example**:
```
BAD (Form-based):
┌─────────────────────┐
│ Video URL: [_____] │
│ Language:  [v]     │
│ Output:    [v]     │
│ [Submit]           │
└─────────────────────┘

GOOD (Conversational):
┌─────────────────────┐
│ User: Summarize     │
│ https://youtu.be/...│
│                     │
│ AI: Processing...   │
└─────────────────────┘
```

---

### 2. **Progressive Disclosure**

**Principle**: Show simple views first, reveal complexity only when needed.

**Implementation**:
- Start with minimal chat interface
- Expand to video panel when relevant
- Hide advanced features until requested

**Hierarchy**:
```
Level 1: Chat input (always visible)
  ↓
Level 2: Video card in messages (when URL processed)
  ↓
Level 3: Detail panel (when user clicks "View")
  ↓
Level 4: Advanced features (MindMap, exports)
```

---

### 3. **Context-Aware**

**Principle**: UI adapts to what the user is currently doing.

**States**:
- **Empty State**: Guidance + demo cards
- **Processing State**: Progress indicators + estimated time
- **Completed State**: Interactive results + Q&A prompts
- **Error State**: Clear error messages + recovery actions

---

### 4. **Keyboard-First (for Power Users)** — *Deferred to Post-MVP*

> ⚠️ **NOTE**: Keyboard shortcuts are **NOT** part of the initial release (MVP). This section is for future reference only. Focus on mouse/touch interactions first.

**Principle**: Every action should have a keyboard shortcut.

**Core Shortcuts** (Post-MVP):
```
Cmd/Ctrl + K     → Open Library
Cmd/Ctrl + /     → Focus chat input
Cmd/Ctrl + \     → Toggle video panel
Esc              → Close panels/modals
Cmd/Ctrl + Enter → Send message
```

**Implementation Priority**: Low (Post-launch enhancement)

---

### 5. **Mobile-Optimized**

**Principle**: Mobile is not an afterthought; design for thumb-reach zones.

**Thumb Zones**:
```
┌──────────────┐
│ Hard to reach│ (Avoid primary actions here)
│              │
│   Easy       │ (Place input, send button)
│   Zone       │
│              │
│ Easy (Bottom)│ (Place tab bar, close buttons)
└──────────────┘
```

---

## 🎯 Design Goals

### Primary Goals
1. **Reduce Time-to-Insight**: From URL paste to first Q&A in <30 seconds
2. **Increase Engagement**: Encourage follow-up questions (3+ messages per session)
3. **Lower Learning Curve**: New users productive in <2 minutes

### Secondary Goals
4. **Visual Consistency**: Reuse components across web/mobile
5. **Performance**: LCP <2s, FID <100ms
6. **Accessibility**: WCAG 2.1 AA compliant

---

## 🚫 Anti-Patterns to Avoid

### ❌ Overloading the Chat
**Bad**: Showing full video player + summary + script in chat messages  
**Good**: Show compact card → Expand in panel

### ❌ Modal Overuse
**Bad**: Opening modals for every action  
**Good**: Use inline expansion or side panels

### ❌ Unclear State
**Bad**: "Processing..." with no indication of progress  
**Good**: "Transcribing (Step 2/4, ~45s remaining)"

### ❌ Desktop-Only Features
**Bad**: Drag-to-resize only works on desktop  
**Good**: Alternative tap gestures on mobile

---

## 📏 Design Constraints

### Technical Constraints
- **Max Panel Width**: 50% of viewport (to keep chat readable)
- **Min Chat Width**: 400px (below this, hide panel)
- **Mobile Breakpoint**: 768px (standard MD breakpoint)

### Content Constraints
- **Max Message Length**: 4000 characters (OpenAI limit)
- **Library List**: Show 20 items initially, lazy load more

### Performance Constraints
- **Video Panel**: Should open in <200ms
- **Library Search**: Debounce 300ms, results <500ms

---

## 🎨 Visual Style Guide

### Color Palette
```
Primary (Chat):    #3ECF8E (Emerald Green)
Background:        #0A0A0A (Deep Black)
Surface:           #1A1A1A (Dark Gray)
Border:            rgba(255,255,255,0.1)
Text Primary:      #FFFFFF
Text Secondary:    rgba(255,255,255,0.7)
```

### Typography
```
Font Family:  "Inter", "Manrope", sans-serif
Headings:     600 weight
Body:         400 weight
Code:         "JetBrains Mono"
```

### Spacing System
```
xs:  4px
sm:  8px
md:  16px
lg:  24px
xl:  32px
2xl: 48px
```

---

## ✅ Design Validation Checklist

Before shipping any new feature, verify:

- [ ] Works on mobile (test on real device, not just DevTools)
- [ ] Keyboard navigable (tab through all interactive elements)
- [ ] High contrast mode compatible
- [ ] Animations are smooth (60fps)
- [ ] Loading states are clear
- [ ] Error messages are actionable

---

## 📚 Reference Examples

**Inspiration Sources**:
- [Perplexity](https://perplexity.ai) - Split-screen chat + sources
- [ChatGPT](https://chat.openai.com) - Conversational UX
- [Linear](https://linear.app) - Keyboard shortcuts
- [Notion AI](https://notion.so) - Inline AI integration

**Next Steps**: See `design/01_layout_specifications.md` for specific layout rules.
