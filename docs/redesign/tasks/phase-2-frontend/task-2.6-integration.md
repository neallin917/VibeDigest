# Task 2.6: Integration & Dual-Theme Polish

> **Phase**: 2 - Frontend Implementation  
> **Priority**: High  
> **Estimated Time**: 1 hour  
> **Dependencies**: All previous Task 2.x items

---

## 🎯 Objective

Wire the **3-Column Layout** together, ensuring data flows correctly between the Icon Sidebar, Chat, and Context Panel. Verify that **Dual Theme** (Glassmorphic Light / Cyber Dark) works flawlessly.

---

## 📋 Prerequisites

- [x] Task 2.1 (ChatWorkspace + Sidebar)
- [x] Task 2.2 (ContextPanel)
- [x] Task 2.3 (LibrarySidebar)
- [x] Task 2.4 (Chat Interface)

---

## 🔨 Implementation Steps

### Step 1: Wire Sidebar Navigation

**File**: `frontend/src/components/chat/ChatWorkspace.tsx`

Ensure the `IconSidebar` correctly toggles the Library sheet and handles routing.

```typescript
// Imports
import { IconSidebar } from './IconSidebar'
import { ChatContainer } from './ChatContainer'
import { VideoDetailPanel } from './VideoDetailPanel'
import { LibrarySidebar } from './LibrarySidebar'

// Inside Component
<IconSidebar 
  onOpenLibrary={() => setIsLibraryOpen(true)} 
/>

<LibrarySidebar
  isOpen={isLibraryOpen}
  onClose={() => setIsLibraryOpen(false)}
  onSelectTask={(id) => {
    setActiveTaskId(id)
    router.push(`?task=${id}`, { scroll: false })
  }}
/>
```

### Step 2: Implement Theme Toggle

**File**: `frontend/src/components/chat/IconSidebar.tsx`

Add a theme toggle button to the bottom of the sidebar.

```tsx
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

// Inside IconSidebar
const { theme, setTheme } = useTheme()

// Add to bottom actions
<button
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-indigo-600 transition-all"
>
  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
  <span className="sr-only">Toggle theme</span>
</button>
```

### Step 3: Verify Context Panel Responsive Logic

**File**: `frontend/src/components/chat/ChatWorkspace.tsx`

Ensure the 3rd column (Context Panel) behaves correctly:
- **Desktop (≥XL)**: Visible as 3rd column.
- **Laptop (<XL)**: Hidden or Slide-over (User preference: Hidden for now).
- **Mobile**: Full screen modal.

```tsx
{/* Desktop/XL Panel */}
<aside className={cn(
  "w-96 flex-none hidden xl:flex flex-col gap-5 transition-all duration-500 ease-in-out",
  activeTaskId ? "w-96 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-20 overflow-hidden"
)}>
  {activeTaskId && (
    <VideoDetailPanel 
      taskId={activeTaskId} 
      onClose={() => setActiveTaskId(null)} 
    />
  )}
</aside>

{/* Mobile Modal */}
<Sheet open={!!(isMobile && activeTaskId)} onOpenChange={(open) => !open && setActiveTaskId(null)}>
  <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-[2rem]">
    <VideoDetailPanel taskId={activeTaskId!} onClose={() => setActiveTaskId(null)} />
  </SheetContent>
</Sheet>
```

### Step 4: Final Polish (Multi-URL Warning)

**File**: `frontend/src/components/chat/ChatContainer.tsx`

Ensure the multi-URL warning logic uses the new styling (Assistant Bubble).

```typescript
if (urls.length > 1) {
  await append({
    role: 'assistant',
    content: "I noticed multiple video URLs. Please send them one at a time for the best analysis."
  })
  return
}
```

---

## ✅ Final Validation Checklist

### Layout & Theming
- [ ] **Light Mode**: Radial gradients, white glass panels, indigo accents.
- [ ] **Dark Mode**: Black background, dark glass panels, emerald accents.
- [ ] **Layout**: 3-Column grid on large screens, stack on mobile.
- [ ] **Animations**: Smooth transitions for panel opening/closing.

### Functionality
- [ ] Sidebar "Projects" button opens Library.
- [ ] Clicking a task in Library opens Context Panel.
- [ ] Theme toggle switches instantly without layout shift.
- [ ] Video player seeks correctly when timestamps clicked.

---

## 🚀 Deployment Readiness

Once this task is verified:
1. Merge branch `feat/redesign-v2`
2. Deploy to Vercel Preview
3. Conduct User Acceptance Testing (UAT)

## 📚 End of Phase 2

**Next Phase**: Phase 3 - Backend & Integration (if needed)
Currently, the backend (Phase 3) is optional if existing endpoints `/api/process-video` work as expected.
