# AGENTS.md — VibeDigest Architecture & Vibe Coding Guide (v3.2)

> **Note to AI Agents**: This document is the Single Source of Truth for the project's architecture. Before writing code, READ this file. If you make architectural changes, UPDATE this file.

---

## 1. Project Overview

VibeDigest is a full-stack tool engineered to download videos, transcribe audio, and generate AI-powered condensed knowledge.

**v3 Changes (Current):**
- **Frontend Migration**: Fully rewritten in **Next.js 14+ (App Router)** & **TailwindCSS**.
- **Backend Migration**: Switched from `faster-whisper` to **OpenAI API** (Official Endpoint).
- **Design System**: "Supabase-style" aesthetic (Dark mode, Glassmorphism, Emerald Green accents).
- **Auth**: **Web2 Only** (Email/Google) via Supabase Auth. Web3 Login removed in v3.1.

### 1.1 Directory Structure & File Placement

- `backend/`: **Backend Source** (Python)
    - `main.py`: FastAPI entry point.
    - `db_client.py`: Supabase Service Role interactions.
    - `transcriber.py`: OpenAI Whisper Integration + `pydub` Chunking.
    - `*.py`: Stateless processors (yt-dlp).
- `frontend/`: **Frontend Source** (Next.js/TypeScript)
    - `src/app/`: App Router pages.
        - `(main)/`: **Protected Route Group** (Sidebar Enabled).
            - `dashboard/`, `history/`, `settings/`, `tasks/`.
        - `page.tsx`: Public Landing Page.
        - `login/`: Auth Page.
    - `src/middleware.ts`: Auth Gatekeeper.
    - `src/components/ui/`: Reusable UI components (Button, Card, etc.).
    - `src/lib/`: Utilities (`utils.ts`), API clients (`api.ts`), Supabase client (`supabase.ts`).
- `scripts/`: Utility scripts (e.g., `start.py`).
- `requirements.txt`: Python dependencies.
- `frontend/package.json`: Node.js dependencies.

---

## 2. Technology Stack

### 2.1 Frontend (Thick Client)
*   **Framework**: Next.js 14 (React 19, App Router).
*   **Language**: TypeScript.
*   **Styling**: TailwindCSS v4, `lucide-react` (icons), `clsx/tailwind-merge`.
*   **Animations**: Framer Motion.
*   **Auth**: 
    *   **Web2**: Supabase Auth (Email OTP, Google OAuth).
    *   **Web3**: Removed.
*   **Data Fetching**: Supabase Client (Realtime) + Custom `ApiClient` for backend commands.

### 2.2 Routing & Middleware
*   **Public Routes**: `/` (Landing), `/login`.
*   **Protected Routes**: `/dashboard/*`.
*   **Middleware**: Enforces session check.
    *   No Session -> Redirect `/dashboard` to `/login`.
    *   Has Session -> Redirect `/login` & `/` to `/dashboard`.

### 2.3 Backend (Service Worker)
*   **Framework**: FastAPI (Python 3.10+).
*   **Role**: Stateless worker. **Triggered via HTTP**, writes state to Supabase.
*   **Key Libs**: `openai`, `yt-dlp`, `pydub`.
*   **Audio Processing**: Automatic chunking for files > 25MB.
*   **Package Manager**: `uv` (Required). All Python commands MUST be run with `uv run`.

### 2.3 Database (Supabase)
*   **Role**: Single Source of Truth for task state.
*   **Realtime**: Enabled for `tasks` and `task_outputs` tables.

---

## 3. Design System & Pattern ("The Vibe")

### 3.1 Visual Language
*   **Theme**: Deep Dark (`#1C1C1C` background).
*   **Accents**: Emerald Green (`#3ECF8E`) for primary actions/success.
*   **Surfaces**: "Glass" effect (Black with 20-40% opacity + blur).
*   **Borders**: Subtle white opacity (`border-white/10`).

### 3.2 Component Pattern
*   **Atomic Design**: Small, reusable components in `src/components/ui/`.
*   **Composition**: Use `children` prop for layout containers (Cards, Layouts).
*   **Styling**: Use `cn()` utility to merge Tailwind classes.
    ```tsx
    // Example
    export function Button({ className, ...props }) {
      return <button className={cn("bg-primary text-white", className)} {...props} />
    }
    ```

---

## 4. Coding Patterns & Standards (Strict Alignment)

To ensure consistency, all Agents MUST follow these implementation patterns.

### 4.1 Next.js Architecture Bounds (CRITICAL)
Due to the App Router's Server-First nature, we enforce these boundaries:

1.  **Client Components (`"use client"`)**:
    *   **MUST** be used for:
        *   Files using `createClient` (from `@/lib/supabase`).
        *   Files using `ApiClient` (interactivity).
        *   Realtime Subscriptions (`supabase.channel`).
        *   Event Handlers (`onClick`, `onSubmit`).
    *   **Rule**: If you import `react` hooks (`useState`, `useEffect`), you MUST add `"use client"` at the top.

2.  **Server Components (Default)**:
    *   **MUST NOT** import `@/lib/supabase` (It is a Browser Client).
    *   **MUST NOT** use `ApiClient` (It relies on browser `fetch` / cookies).
    *   **Usage**: Use Server Components *only* for static layout shell or initial data fetching if we implement `@supabase/ssr` Server Client (Not yet implemented in v3.1). **Currently, most Logic is Client-Side.**

### 4.2 Frontend Component Pattern
*   **Library**: `class-variance-authority` (CVA) + `clsx` + `tailwind-merge`.
*   **Structure**:
    ```tsx
    // 1. Define Variants
    const buttonVariants = cva("base-classes", {
        variants: { variant: { default: "...", supa: "..." } }
    })
    
    // 2. Export Component
    export const Button = forwardRef(({ className, variant, ...props }, ref) => (
        <button className={cn(buttonVariants({ variant }), className)} ref={ref} {...props} />
    ))
    ```
*   **Rule**: Do not write raw tailwind classes for variant logic inside the generic component body. Use CVA.

### 4.3 Data Fetching Pattern
*   **Command (Write)**: Use `ApiClient` (Static Class).
    *   Path: `src/lib/api.ts`
    *   Usage: `await ApiClient.processVideo(...)`
    *   Context: Used for triggering backend actions (POST).
*   **Query (Read)**: Use `Supabase Client` (Realtime).
    *   Path: `src/lib/supabase.ts`
    *   Usage: `supabase.from('tasks').select('*')` or `.channel().on(...)`
    *   Context: Used for fetching state and listening to updates.
*   **Rule**: **Separation of Concerns**. Never use `ApiClient` to poll for status. Never use `Supabase` to trigger compute jobs (compute queues excepted, but here we use direct API).

---

## 5. Architecture & Data Flow

### 5.1 The "Control Plane vs. Data Plane" Model
*   **Control Plane (HTTP)**: Frontend calls Python Backend (`POST /api/process-video`) to **start** work.
*   **Data Plane (Realtime)**: Frontend subscribes to Supabase (`supabase.channel`) to **watch** work.
*   **Rule**: Frontend **NEVER** waits for the HTTP response to update the UI. It waits for the **Database** to update via Realtime.

### 5.2 State Machine (Database)
The database schema (`tasks`, `task_outputs`) remains the authoritative state.
*   `tasks.status`: `pending` -> `processing` -> `completed` | `error`
*   **Updates**: Only the Backend (via `db_client.py`) can write to these tables. Frontend has **Read-Only** access.

---

## 6. Concurrency & Deployment Model

### 6.1 Backend Worker Model
*   **Type**: HTTP Triggered Worker (Push Model).
*   **Mechanism**: `POST /api/process-video` -> FastAPI `BackgroundTasks`.
*   **Scaling**: Support for **Horizontal Scaling** (Multi-Instance). Each request spawns an async task.

### 6.2 Concurrency via Database
*   **Constraint**: The Database (`tasks.status`) is the **only logic lock**.
*   **Guarantee**: `pending` state is the only valid entry point for a worker. The first worker to update status to `processing` locks the task.
*   **Safety**: Multiple backend instances can run safely side-by-side as long as they respect the DB state machine.

### 6.3 Vercel Deployment (Frontend)
*   **Platform**: Vercel (Next.js native).
*   **Connectivity**: Connects to Backend via **Cloudflare Tunnel** (Public URL).
*   **Config**: Requires `NEXT_PUBLIC_API_URL` to point to the Tunnel URL.


---

## 7. Identity & Authentication

### 7.1 The "Single Identity Source" Rule
*   **Source of Truth**: The `auth.users` table in Supabase.
*   **Web3 Deprecation**: Wallet login is **disabled**. Do not re-enable without a full SIWE implementation plan.

### 7.2 Identity Merging Policy
*   **Strict Isolation**: **Email Account != Wallet Account**.
*   **No Auto-Merge**: System MUST NOT automatically link a wallet to an email user based on inference. Merging must be explicit and authenticated (Feature Pending).
*   **Risk**: Auto-merging leads to account hijacking if a wallet is compromised or shared.

---

## 8. Secrets Management (Expanded)

### 8.1 Critical Secrets (Backend Only)
*   `SUPABASE_SERVICE_KEY`: Grants `service_role` (Admin) access.
    *   **Location**: `backend/.env` ONLY.
    *   **Usage**: Used by `db_client.py` to write updates to `tasks`.
    *   **Risk**: If leaked, attacker can wipe database. **NEVER commit to Git.**
*   `OPENAI_API_KEY`: Required for transcription and summarization.
    *   **Location**: `backend/.env`.

### 8.2 Public Config (Frontend)
*   `NEXT_PUBLIC_SUPABASE_URL`: API Endpoint.
*   `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Client Key.
    *   **Location**: `frontend/.env.local`.
    *   **Usage**: Used by `@/lib/supabase` for Realtime and valid RLS queries.
    *   **Safety**: Safe to expose in browser (protected by RLS).
*   `NEXT_PUBLIC_API_URL`: Backend Public URL.
    *   **Location**: `frontend/.env.local` (Local) / Vercel Env Vars (Prod).
    *   **Value**: `http://localhost:8000` (Local) / `https://transcriber.neallin.xyz` (Prod).


### 8.3 Token Validation
*   **Rule**: The Backend must never trust `user_id` passed in the HTTP Body.
*   **Mechanism**: Backend **MUST** validate the `Authorization: Bearer <JWT>` header using Supabase Auth to derive the true `user_id`.

---

## 9. API Contract (Minimal Principle)

### 9.1 Core Endpoints
*   `POST /api/process-video`:
    *   **Input**: `video_url`, `summary_language`, `translate_targets`.
    *   **Output**: `task_id` (Immediate acknowledgment).
    *   **Behavior**: Spawns background task. Does **NOT** wait for completion.
*   `POST /api/retry-output`:
    *   **Input**: `output_id`.
    *   **Output**: `message` (Queued).

### 9.2 Non-Existent Endpoints
*   **NO** `GET /api/tasks`: Frontend reads from Supabase directly.
*   **NO** `GET /api/status`: Frontend reads from Supabase Realtime.
*   **NO** `DELETE /api/tasks`: Frontend calls Supabase (subject to RLS).

---

## 10. Implementation Rules for Agents

1.  **Adding UI**: Check `src/components/ui` first. Do not hardcode CSS if a component exists (Card, Button, Badge).
2.  **New Page**: Create `page.tsx` in `src/app/`. Use `layout.tsx` for shared persistence.
3.  **Backend Changes**: If modifying `main.py`, ensure `db_client.py` handles the DB logic. Keep `main.py` control-focused.
4.  **Formatting**: Run `npm run lint` for frontend changes.

---

## 11. Roadmap & Status

*   [x] **Next.js Migration**: Completed.
*   [x] **OpenAI Backend Migration**: Completed (v3.2).
*   [x] **Login Page**: Restored (Email/Google).
*   [x] **Web3 Support**: Removed (v3.1).
*   [x] **Cloud Deployment**: Hybrid (Vercel Frontend + Home Lab Backend).
