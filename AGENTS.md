# AGENTS.md — VibeDigest Architecture & Vibe Coding Guide (v3.3)

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
    - `main.py`: FastAPI entry point (Control Plane).
    - `db_client.py`: Supabase Service Role interactions (Data Plane).
    - `transcriber.py`: OpenAI Whisper Integration + `pydub` Chunking.
    - `notifier.py`: Email notifications via Resend.
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
- `scripts/`: Utility scripts.
    - `start.py`: Production runner script.
- `requirements.txt`: Python dependencies.
- `frontend/package.json`: Node.js dependencies.

---

## 2. Key Commands

Quick reference for common development and deployment operations.

### Frontend
```bash
# Start Development Server (Next.js)
npm run dev

# Run Line/Static Analysis
npm run lint

# Build for Production
npm run build
```

### Backend (Python)
*Note: All Python commands MUST be run with `uv`.*

```bash
# Start FastAPI Server Locally (Dev)
uv run main.py

# Start Production Worker Runner
uv run scripts/start.py

# Install/Sync Dependencies
uv pip install -r requirements.txt
```

### Infrastructure (Docker)
```bash
# Start Full Stack (Traefik + Backend)
docker-compose up -d

# Rebuild Backend Container (Required after requirements change)
docker-compose up --build -d transcriber-backend

# Run Test Backend (Port 8001)
docker-compose -f docker-compose.test.yml up -d
```

---

## 3. Technology Stack

### 3.1 Frontend (Thick Client)
*   **Framework**: Next.js 14 (React 19, App Router).
*   **Language**: TypeScript.
*   **Styling**: TailwindCSS v4, `lucide-react` (icons), `clsx/tailwind-merge`.
*   **Animations**: Framer Motion.
*   **Auth**: Supabase Auth (Email OTP, Google OAuth).
*   **Data Fetching**: Supabase Client (Realtime) + Custom `ApiClient` for commands.

### 3.2 Backend (Service Worker)
*   **Framework**: FastAPI (Python 3.10+).
*   **Role**: Stateless worker. **Triggered via HTTP**, writes state to Supabase.
*   **Key Libs**: `openai`, `yt-dlp`, `pydub`, `resend`.
*   **Package Manager**: `uv` (Required).

### 3.3 Database (Supabase)
*   **Role**: Single Source of Truth for task state.
*   **Realtime**: Enabled for `tasks` and `task_outputs` tables.
*   **Pricing**: `profiles` table tracks credits/usage. (New in v3.3)
    *   `tier`: 'free' | 'pro'
    *   `usage_count`: Monthly resets
    *   `extra_credits`: Top-up packs

---

## 4. Architecture & Core Application Flow

### 4.1 The "Control Plane vs. Data Plane" Model
*   **Control Plane (HTTP)**: Frontend calls Python Backend (`POST /api/process-video`) to **start** work.
*   **Data Plane (Realtime)**: Frontend subscribes to Supabase (`supabase.channel`) to **watch** work.
*   **Rule**: Frontend **NEVER** waits for the HTTP response to update the UI. It waits for the **Database** to update via Realtime.

### 4.2 Core Application Flow (Step-by-Step)

1.  **Submission**:
    *   User submits YouTube URL in `TaskForm`.
    *   Frontend calls `ApiClient.processVideo()`.
2.  **Scheduling**:
    *   Backend `main.py` receives request.
    *   Background Task spawned (`FastAPI.BackgroundTasks`).
    *   Immediate HTTP 200 OK returned with `task_id`.
3.  **Processing (Async)**:
    *   Worker checks Supabase: Is this video already done?
    *   If New:
        *   Sets `tasks.status = 'processing'`.
        *   Downloads audio (`yt-dlp`).
        *   Transcribes (`OpenAI Whisper`).
        *   Generates Summary (`OpenAI ChatCompletion`).
    *   If Cached:
        *   Skips processing, returns existing `output_id`.
4.  **Completion & Notification**:
    *   Worker updates `tasks.status = 'completed'` and inserts `task_outputs`.
    *   Worker triggers `notifier.py` to send email (if enabled).
5.  **UI Update**:
    *   Supabase Realtime pushes change to Frontend.
    *   Frontend updates `TaskCard` from "Processing" to "Done".

### 4.3 Core Data Models
**Table: `tasks`**
*   `id` (UUID): Primary Key.
*   `user_id` (UUID): Owner.
*   `video_url` (Text): Input.
*   `thumbnail_url` (Text): Best-effort cover image (e.g. YouTube thumbnail / Bilibili cover / Xiaoyuzhou episode cover).
*   `status` (Enum): `pending` | `processing` | `completed` | `failed`.
*   `is_deleted` (Boolean): Soft delete flag (default `false`).

**Table: `task_outputs`**
*   `id` (UUID): Primary Key.
*   `task_id` (UUID): FK to `tasks`.
*   `kind` (Text/Enum): Output type.
    *   `script`: Transcript markdown (read-only content).
    *   `summary`: AI summary markdown/text.
    *   `translation`: Translated transcript/summary.
    *   `audio` (Xiaoyuzhou only): JSON payload in `content` with:
        *   `audioUrl`: Direct playable audio URL (no Supabase Storage usage).
        *   `coverUrl`: Episode cover URL (prefer Xiaoyuzhou `__NEXT_DATA__.props.pageProps.episode.image.*PicUrl`).
*   `content` (Text): Output payload (string or JSON string depending on kind).
*   `status` (Enum): `pending` | `processing` | `completed` | `error`.

---

## 5. Design System & Pattern ("The Vibe")

### 5.1 Visual Language
*   **Theme**: Deep Dark (`#1C1C1C` background).
*   **Accents**: Emerald Green (`#3ECF8E`) for primary actions/success.
*   **Surfaces**: "Glass" effect (Black with 20-40% opacity + blur).
*   **Borders**: Subtle white opacity (`border-white/10`).

### 5.2 Component Pattern
*   **Atomic Design**: Small, reusable components in `src/components/ui/`.
*   **Composition**: Use `children` prop for layout containers.
*   **Styling**: Use `cn()` utility to merge Tailwind classes.
    ```tsx
    export function Button({ className, ...props }) {
      return <button className={cn("bg-primary text-white", className)} {...props} />
    }
    ```

---

## 6. Coding Patterns & Standards (Strict Alignment)

### 6.1 Next.js Architecture Bounds
1.  **Client Components (`"use client"`)**:
    *   Required for: `createClient` (Supabase), `ApiClient`, `useState`, `useEffect`.
2.  **Server Components (Default)**:
    *   Used only for static shells/layouts.
    *   **MUST NOT** import `@/lib/supabase` (Browser Client).

### 6.2 Frontend Component Pattern
*   **Library**: `class-variance-authority` (CVA) + `clsx` + `tailwind-merge`.
*   **Rule**: Do not write raw tailwind classes for variant logic. Use CVA.

### 6.3 Data Fetching Pattern
*   **Command (Write)**: `ApiClient` (`src/lib/api.ts`).
*   **Query (Read)**: `Supabase Client` (`src/lib/supabase.ts`).
*   **Rule**: **Separation of Concerns**. Never use `ApiClient` to poll. Never use `Supabase` to trigger compute.

### 6.4 i18n (Multi-Language UI)
*   **Client-Side Strategy**: `src/lib/i18n.ts`.
*   **Usage**: `const { t } = useI18n()`.
*   **Persistence**: `localStorage` (`vd.locale`).
*   **Fallback**: English (`en`).

---

## 7. Concurrency & Deployment Model

### 7.1 Backend Worker Logic
*   **Type**: HTTP Triggered Worker (Push Model).
*   **Concurrency**: Controlled by Database Locking (`tasks.status`).
    *   `pending` -> `processing` transition is the atomic lock.

### 7.2 Hybrid Deployment
*   **Frontend**: Vercel (Global Edge).
*   **Backend**: Home Lab / Mac Mini (Cloudflare Tunnel).
    *   Exposed via `cloudflared` -> Traefik -> Docker Container.

### 7.3 Environment Separation
*   **Production**: `vibedigest.neallin.xyz` (Prod DB).
*   **Development**: `localhost` or Preview URL (Dev DB).
*   **Rule**: "Prod is Sacred". Never test against Prod DB.

---

## 8. Identity & Secrets Management

### 8.1 Authentication
*   **Source of Truth**: Supabase `auth.users`.
*   **Web3**: Disabled.
*   **Validation**: Backend validates `Authorization: Bearer <JWT>` header.

### 8.2 Secrets Reference
| Secret | Location | Purpose | Safety |
| :--- | :--- | :--- | :--- |
| `SUPABASE_SERVICE_KEY` | Backend `.env` | Admin DB Access | **CRITICAL (Private)** |
| `OPENAI_API_KEY` | Backend `.env` | AI Generation | **CRITICAL (Private)** |
| `RESEND_API_KEY` | Backend `.env` | Email Sending | **CRITICAL (Private)** |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend `.env` | Public API URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend `.env` | Public Client Key | Public |

---

## 9. API Contract

### Core Endpoints
*   `POST /api/process-video`: Start video processing.
    *   Input: `{ video_url, language, ... }`
*   `POST /api/retry-output`: Retry failed task.

### Forbidden Patterns
*   **NO** `GET /api/status`: Use Supabase Realtime.
*   **NO** `DELETE /api/tasks`: Use Supabase Client (Soft Delete `is_deleted=true`).

---

## 10. Implementation Rules

1.  **Adding UI**: Check `src/components/ui` first.
2.  **New Page**: Create `page.tsx` in `src/app/`.
3.  **Backend Changes**: `main.py` = Control; `db_client.py` = Data.
4.  **Formatting**: Run `npm run lint` before commit.

---

## 11. Roadmap

*   [x] **Next.js Migration**
*   [x] **OpenAI Backend Migration**
*   [x] **Email Notifications (Resend)**
*   [ ] **Vector Search (Embeddings)**
*   [ ] **Stripe Integration**
