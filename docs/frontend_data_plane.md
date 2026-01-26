# Frontend Data Plane Integration Guide

> **Note**: This guide details the "Data Plane" architecture used in VibeDigest's frontend to handle asynchronous task updates via Supabase Realtime.

## 1. The Core Philosophy: "Control vs. Data"

VibeDigest uses a strict separation between **Control Plane** (triggering actions) and **Data Plane** (observing state).

### 1.1 Control Plane (HTTP)
*   **Purpose**: Trigger high-latency operations (e.g., "Start Video Processing").
*   **Mechanism**: Standard REST API calls (e.g., `POST /api/process-video`).
*   **Response**: Returns immediately with a generic "Accepted" or Task ID.
*   **Rule**: The frontend **NEVER** relies on the HTTP response body for the final result content.

### 1.2 Data Plane (Realtime)
*   **Purpose**: Maintain sync with the backend state.
*   **Mechanism**: Supabase Realtime (PostgreSQL Replication).
*   **Flow**: Backend updates DB → Supabase pushes to Client → UI Updates.
*   **Rule**: The UI reflects the **Database State**, not the API Response.

---

## 2. Implementation Pattern

### 2.1 The "Fire and Forget" Flow

When the user submits a URL, the frontend performs a "Fire and Forget" operation:

1.  **Call API**: Frontend calls `ApiClient.processVideo(url)`.
2.  **Ignore Result**: The specific API response is ignored for rendering purposes.
3.  **Watch DB**: A global or component-level subscription listener picks up the new row in `tasks`.

### 2.2 Subscribing to Changes

We use Supabase channels to listen for `INSERT` and `UPDATE` events on the `tasks` and `task_outputs` tables.

```typescript
// Conceptual Example
const channel = supabase
  .channel('table-db-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${userId}`,
    },
    (payload) => {
      // payload.new contains the updated record
      // Update local React state / Context / Cache
      updateLocalState(payload.new)
    }
  )
  .subscribe()
```

### 2.3 Handling Task Completion

When the backend finishes a task:
1.  **Backend**: Python worker updates `tasks.status = 'completed'` and inserts rows into `task_outputs`.
2.  **Supabase**: Triggers a Realtime event.
3.  **Frontend**: Receives the event and updates the `TaskCard` from "Processing" to "Done".

---

## 3. Best Practices

### 3.1 No Polling
**Strict Rule**: Never use `setInterval` or recursive `setTimeout` to check task status. Always use Realtime. Polling is inefficient and breaks the VibeDigest architectural pattern.

### 3.2 Optimistic Updates
You may optimistically add a placeholder card to the UI immediately after the API call if needed for perceived latency, but the Source of Truth remains the Realtime `INSERT` event from the database.

### 3.3 Error Handling
*   **Control Plane Errors**: If the `POST` request fails (e.g., 500 or Network Error), show a toast notification immediately.
*   **Data Plane Errors**: If the backend fails during processing, it updates the task status to `failed`. The frontend should reflect this state in the `TaskCard`.

### 3.4 Connection State
Realtime connections can drop. Critical views (like the Dashboard/Chat) should implement a revalidation strategy (e.g., fetch latest data) on window focus or reconnection events to ensure consistency.

---

## 4. Reference
*   **Architecture Source**: `AGENTS.md` (Section 4).
*   **Client Library**: `supabase-js` v2.
*   **State Management**: `useTasks` hook (or equivalent context) manages the subscription lifecycle.
