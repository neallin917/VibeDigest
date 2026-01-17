# Layout Specifications (Dual Theme)

> **Purpose**: Define layout and theming rules for VibeDigest v2.0  
> **Source**: Combined from `chat_draft_design.html` (Light) and Original Plan (Dark)  
> **Last Updated**: 2025-01-18

---

## 🎨 Global Theming System

We use `next-themes` to toggle between **Light (Glassmorphic)** and **Dark (Cyber)** modes.

| Feature | **Light Mode** (New) | **Dark Mode** (Original) |
| :--- | :--- | :--- |
| **Vibe** | "Frosty Morning" | "Deep Space" |
| **Background** | Radial Gradients (Indigo/Pink/White) | Solid Deep Black (`#0A0A0A`) |
| **Primary Color** | Indigo (`text-indigo-600`) | Emerald (`text-emerald-500`) |
| **Surface** | `bg-white/65` + High Blur (`blur-xl`) | `bg-white/5` + Low Blur (`blur-md`) |
| **Text** | Slate (`text-slate-600`) | Gray (`text-gray-300`) |
| **User Bubble** | Indigo Gradient | Emerald/Black Glass |
| **AI Bubble** | White Glass | Dark Gray Glass (`#1A1A1A`) |

### CSS Variables (Tailwind Config)
To handle this cleanly, we use CSS variables or Tailwind `dark:` modifiers.

```css
/* Globals */
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
}

/* Light Mode Background */
body:not(.dark) {
  background: 
    radial-gradient(circle at 0% 0%, #eef2ff 0%, transparent 50%), 
    radial-gradient(circle at 100% 0%, #fce7f3 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, #e0f2fe 0%, transparent 50%),
    #ffffff;
  background-attachment: fixed;
}

/* Dark Mode Background */
body.dark {
  background-color: #0A0A0A;
  background-image: radial-gradient(circle at 50% 0%, #1a1a1a 0%, #0A0A0A 60%);
}
```

---

## 🖥️ Desktop Layout (≥1280px)

We adopt the **3-Column Layout** from the draft for *both* themes.

```
┌──────┬───────────────────────────────┬──────────────────────┐
│ Icon │                               │                      │
│ Nav  │        Chat Interface         │    Context Panel     │
│      │           (Flex-1)            │       (384px)        │
│(64px)│                               │                      │
└──────┴───────────────────────────────┴──────────────────────┘
```

### 1. Icon Sidebar (Left)
- **Width**: `w-16` (64px)
- **Style**: 
  - Light: `bg-white/65 border-white/40 shadow-sm`
  - Dark: `bg-black/40 border-white/10`
- **Shape**: `rounded-[2rem]` (floating look)
- **Content**: Icon buttons (Chat, Projects, Settings).

### 2. Main Chat (Center)
- **Container**: `flex-1 flex flex-col`
- **Panel Style**: 
  - Light: `bg-white/65 shadow-glass ring-1 ring-white/60`
  - Dark: `bg-[#1A1A1A]/50 ring-1 ring-white/5`
- **Shape**: `rounded-[2.5rem]`
- **Header**: 64px height, contains Title + "Online" status + Actions.
- **Input Area**: 
  - Position: Floating at bottom (`absolute bottom-6`).
  - Style: Capsule shape (`rounded-full`).

### 3. Context Panel (Right)
- **Width**: `w-96` (384px)
- **Visibility**: Hidden on `< xl`, visible on larger screens.
- **Content**:
  - **Video Player**: Top card.
  - **Insights**: "Extracted Points" cards.
  - **Action Items**: "Next Steps" cards.

---

## 📱 Mobile Layout (<768px)

### Stack + Modal
- **Sidebar**: Becomes a bottom sheet menu or hidden behind a burger icon.
- **Context Panel**: Becomes a full-screen modal (`Sheet`) when a video is active.
- **Input**: Fixed at bottom (not floating).

---

## 🧩 Component Styles (Dual Theme)

### Glass Panel Utility
```tsx
const glassPanel = cn(
  "backdrop-blur-xl border transition-all",
  // Light
  "bg-white/65 border-white/50 shadow-glass",
  // Dark
  "dark:bg-white/5 dark:border-white/10 dark:shadow-none"
)
```

### Message Bubbles
**User**:
- Light: `bg-indigo-600 text-white shadow-indigo-200`
- Dark: `bg-emerald-600/20 text-emerald-100 border border-emerald-500/20`

**Assistant**:
- Light: `bg-white/80 border-white/60 text-slate-700`
- Dark: `bg-[#1A1A1A] border-white/5 text-gray-300`

### Cards (Insights/Video)
- Light: `glass-card-active` (Gradient white)
- Dark: `bg-black/40 border border-white/10`

---

## ✅ Implementation Checklist

- [ ] Install `next-themes`
- [ ] Configure `tailwind.config.ts` for `darkMode: 'class'`
- [ ] Add `Plus Jakarta Sans` font
- [ ] Define `.blob` animations in global CSS
- [ ] Build `ChatWorkspace` with 3-column grid
- [ ] Ensure all components use `dark:` modifiers for the Emerald theme
