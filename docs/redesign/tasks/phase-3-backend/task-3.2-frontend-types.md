# Task 3.2: Frontend Types & UI Sync

> **Phase**: 2 - Backend Intelligence  
> **Priority**: High  
> **Dependencies**: Task 3.0 (Backend Prompts Updated)

---

## 🎯 Objective

Update the frontend `StructuredSummary` type definition and the `VideoDetailPanel` UI to render the newly available **Action Items** and **Risks**.

---

## 🔨 Implementation Steps

### Step 1: Update Type Definition

**File**: `frontend/src/components/chat/VideoDetailPanel.tsx`

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

### Step 2: Render Action Items Section

Add a new section in `VideoDetailPanel.tsx` below Keypoints.

```tsx
{summary?.action_items && summary.action_items.length > 0 && (
  <>
    <div className="flex items-center gap-3 px-2 mt-6">
      <span className="text-[11px] font-bold text-indigo-400 dark:text-emerald-400 uppercase tracking-widest">
        Action Items
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent dark:from-emerald-900" />
    </div>
    
    <div className="space-y-3">
      {summary.action_items.map((item, idx) => (
        <div key={idx} className={cn(
          "rounded-[20px] p-4 flex gap-3 items-start",
          "bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/5"
        )}>
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
              {item.content}
            </p>
            {item.priority && (
              <span className="text-[10px] uppercase font-bold text-slate-400">
                {item.priority} Priority
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  </>
)}
```

### Step 3: Render Risks Section

Add a new section for Risks.

```tsx
{summary?.risks && summary.risks.length > 0 && (
  <>
    <div className="flex items-center gap-3 px-2 mt-6">
      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-widest">
        Risks & Warnings
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-rose-200 to-transparent dark:from-rose-900" />
    </div>
    
    <div className="space-y-3">
      {summary.risks.map((item, idx) => (
        <div key={idx} className={cn(
          "rounded-[20px] p-4 flex gap-3 items-start",
          "bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30"
        )}>
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-800 dark:text-rose-200 font-medium">
            {item.content}
          </p>
        </div>
      ))}
    </div>
  </>
)}
```

---

## ✅ Validation Checklist

- [ ] "Action Items" appear when backend returns them.
- [ ] "Risks" appear with red/rose styling when present.
- [ ] UI handles missing/empty arrays gracefully.
