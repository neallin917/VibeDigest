# Task 3.0: Prompt Engineering & Schema Upgrade

> **Phase**: 2 - Backend Intelligence  
> **Priority**: Critical  
> **Estimated Time**: 2 hours  
> **Dependencies**: Frontend Phase Completed

---

## 🎯 Objective

Upgrade the LLM Prompt in `summarizer.py` to generate **Structured Actionable Intelligence** instead of generic summaries. The goal is to populate the new "Glassmorphic Cards" in the frontend Context Panel.

---

## 🏗️ Schema Definition (v2)

### Current Schema (v1)
```json
{
  "overview": "...",
  "keypoints": [
    { "title": "...", "detail": "...", "startSeconds": 120 }
  ]
}
```

### New Target Schema (v2)
```json
{
  "overview": "Concise 2-sentence summary of the core value.",
  "keypoints": [
    { "title": "...", "detail": "...", "startSeconds": 120, "type": "insight" }
  ],
  "action_items": [
    { "content": "Start beta testing next month", "priority": "high" }
  ],
  "risks": [
    { "content": "Potential delay in API migration", "severity": "medium" }
  ],
  "meta": {
    "tone": "informative",
    "target_audience": "developers"
  }
}
```

---

## 🔨 Implementation Steps

### Step 1: Update `summarizer.py`

**File**: `backend/summarizer.py`

Modify `summarize_in_language_with_anchors` method to use the new Prompt Template.

**New Prompt Strategy**:
1.  **Role**: "You are an elite business analyst."
2.  **Task**: Extract **Action Items** (Next Steps) and **Risks** (Warnings/Downsides) in addition to Key Insights.
3.  **Format**: Strict JSON (v2 Schema).

### Step 2: Update `workflow.py` (Validation)

**File**: `backend/workflow.py`

Ensure the `summarize` node handles the new schema correctly.
- If the LLM fails to return `action_items` or `risks` (e.g. for short videos), default to empty arrays `[]`.
- Ensure backwards compatibility (don't break if `keypoints` are missing).

### Step 3: Frontend Type Sync

**File**: `frontend/src/components/chat/VideoDetailPanel.tsx`

Update the `StructuredSummaryV1` type to match the new backend output.

```typescript
type StructuredSummaryV2 = {
    overview: string
    keypoints: Array<{
        title: string
        detail: string
        startSeconds?: number
    }>
    action_items?: Array<{ content: string; priority?: string }>
    risks?: Array<{ content: string; severity?: string }>
}
```

---

## ✅ Validation Checklist

- [ ] Backend generates valid JSON with `action_items` and `risks`.
- [ ] Frontend Context Panel renders "Action Item" cards correctly.
- [ ] Frontend Context Panel renders "Risk" cards (styled as warnings).
- [ ] Fallback works (if no actions/risks found, sections are hidden).

## 📝 Next Steps

Execute `task-3.1-backend-parsing.md` to apply these changes.
