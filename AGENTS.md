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

**Recent (Post-v3.3) Additions:**
- **Seekable Playback**: Task detail page supports click-to-seek for YouTube/Bilibili embeds and audio sources.
- **Transcript Timeline UX**: Full script is rendered as clickable "timeline blocks" derived from `task_outputs(kind="script_raw")`.
- **Supadata (Optional, YouTube Fallback)**: Backend can fetch YouTube transcripts from Supadata when `SUPADATA_API_KEY` is configured, skipping heavy download/transcribe where possible.

### 1.1 Directory Structure & File Placement

- `backend/`: **Backend Source** (Python)
    - `main.py`: FastAPI entry point (Control Plane).
    - `db_client.py`: Supabase Service Role interactions (Data Plane).
    - `transcriber.py`: OpenAI Whisper Integration + `pydub` Chunking.
    - `notifier.py`: Email notifications via Resend.
    - `supadata_client.py`: **Optional** Supadata transcript fetcher (YouTube only) using `httpx`.
    - `scripts/`: Internal utility and debugging scripts (e.g., `debug_log.py`).
    - `*.py`: Stateless processors (yt-dlp).
- `frontend/`: **Frontend Source** (Next.js/TypeScript)
    - `src/app/`: App Router pages.
        - `(main)/`: **Protected Route Group** (Responsive Navigation Shell).
            - Desktop (`md+`): Sidebar navigation.
            - Mobile (`< md`): Sticky top header + bottom tab navigation.
            - `dashboard/`, `history/`, `settings/`, `tasks/`.
        - `page.tsx`: Public Landing Page.
        - `login/`: Auth Page.
    - `src/middleware.ts`: Auth Gatekeeper.
    - `src/components/ui/`: Reusable UI components (Button, Card, etc.).
    - `src/components/layout/`: App shell & navigation (`Sidebar`, `MobileNav`, shared `navItems`).
    - `src/components/tasks/`: Media + transcript UX
        - `VideoEmbed.tsx`: Video source routing + seek controller (YouTube via JS API; Bilibili best-effort reload).
        - `YouTubePlayer.tsx`: YouTube IFrame Player API wrapper with `seek(seconds)` controller.
        - `AudioEmbed.tsx`: HTML5 audio player with `seek(seconds)` controller.
        - `TranscriptKeyframesPanel.tsx`: Collapsible "Timeline (beta)" keyframes panel.
        - `TranscriptTimeline.tsx`: Clickable transcript blocks (full script timeline).
        - `transcript.ts`: `script_raw` parsing + time formatting helpers.
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

# Restart Backend Container (Quick restart)
docker compose restart transcriber-backend

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
*   **Notifications**: Browser Notifications API via `useTaskNotification` hook.

### 3.2 Backend (Service Worker)
*   **Framework**: FastAPI (Python 3.10+).
*   **Role**: Stateless worker. **Triggered via HTTP**, writes state to Supabase.
*   **Key Libs**: `openai`, `yt-dlp`, `pydub`, `resend`, `httpx` (Supadata optional).
*   **Package Manager**: `uv` (Required).

### 3.3 Database (Supabase)
*   **Role**: Single Source of Truth for task state.
*   **Realtime**: Enabled for `tasks` and `task_outputs` tables.
*   **Pricing**: `profiles` table tracks credits/usage. (New in v3.3)
    *   `tier`: 'free' | 'pro'
    *   `usage_count`: Monthly resets
    *   `extra_credits`: Top-up packs
    *   **Logic**:
        *   **Annual Support**: Frontend handles toggle (`isAnnual`) to switch Creem Product IDs.
        *   **Localization**: Plan names/features are fully localized in `i18n.ts`.

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
        *   For YouTube: if `SUPADATA_API_KEY` is configured, **try Supadata transcript** first.
            *   If Supadata succeeds: fetch metadata only (`yt-dlp` info extract), persist `script_raw` + `script` from Supadata segments.
            *   If Supadata fails/unavailable: fallback to download + Whisper.
        *   Downloads audio (`yt-dlp`) (fallback path).
        *   Transcribes (`OpenAI Whisper`) (fallback path).
        *   Generates Summary (`OpenAI ChatCompletion`).
        *   Generates Summary (`OpenAI ChatCompletion`).
    *   If Cached (Exact Match):
        *   **Clones** outputs from the existing task to the new task.
        *   Sets status to 'completed' immediately.
    *   If Smart Resume (Partial Match):
        *   **Reuses** existing `script` output from DB to skip Download/Transcribe.
        *   Only runs Summary/Translation steps.
4.  **Completion & Notification**:
    *   Worker updates `tasks.status = 'completed'` and inserts `task_outputs`.
    *   Worker triggers `notifier.py` to send email (if enabled).
5.  **UI Update & Notification**:
    *   Supabase Realtime pushes change to Frontend.
    *   Frontend updates `TaskCard` from "Processing" to "Done".
    *   `useTaskNotification` hook triggers a browser notification if subscribed.

### 4.3 Core Data Models
**Table: `tasks`**
*   `id` (UUID): Primary Key.
*   `user_id` (UUID): Owner.
*   `video_url` (Text): Input.
*   `thumbnail_url` (Text): Best-effort cover image (e.g. YouTube thumbnail / Bilibili cover / Xiaoyuzhou episode cover).
*   `status` (Enum): `pending` | `processing` | `completed` | `failed`.
*   `is_deleted` (Boolean): Soft delete flag (default `false`).
*   `is_demo` (Boolean): Demo task flag (default `false`). Demo tasks are visible to all users.

**Table: `task_outputs`**
*   `id` (UUID): Primary Key.
*   `task_id` (UUID): FK to `tasks`.
*   `kind` (Text/Enum): Output type.
    *   `script`: Transcript markdown (read-only content).
    *   `summary`: AI summary markdown/text.
    *   `summary_source`: Stable summary in transcript/source language (used for time-anchored keypoints + bilingual toggle).
    *   `translation`: Translated transcript/summary.
    *   `audio` (Xiaoyuzhou only): JSON payload in `content` with:
        *   `audioUrl`: Direct playable audio URL (no Supabase Storage usage).
        *   `coverUrl`: Episode cover URL (prefer Xiaoyuzhou `__NEXT_DATA__.props.pageProps.episode.image.*PicUrl`).
*   `content` (Text): Output payload (string or JSON string depending on kind).
*   `status` (Enum): `pending` | `processing` | `completed` | `error`.

### 4.4 Demo Task Management

Demo tasks are featured content visible to all users (including anonymous visitors) on the Dashboard's "Community Examples" section.

**Single Source of Truth**: The `is_demo` field in the `tasks` table.

**How to add/remove demo tasks:**
1. Open **Supabase Dashboard → Table Editor → tasks**.
2. Find the target task by ID or title.
3. Set `is_demo = true` to make it a demo, or `false` to remove it.
4. **No code changes required** — frontend automatically queries `is_demo = true`.

**RLS Policy**: Demo tasks have special RLS rules allowing read-access for all users:
- Anonymous users: Can view tasks where `is_demo = true`.
- Authenticated users: Can view own tasks OR tasks where `is_demo = true`.

**SQL Migration**: `backend/sql/09_multiple_demo_tasks.sql` sets up the field and policies.

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
*   **Brand / App Name**: Use `t("brand.name")` for the product name and `t("brand.appName")` for the UI app label (avoid hard-coded strings in headers/menus).

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
| `SUPADATA_API_KEY` | Backend `.env` | Optional YouTube transcript fetch (Supadata) | **Private** |
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

## 10. Testing Standards (Strict Rules)
> **Constraint**: All automated tests must be **cost-free**.

### 10.1 Zero Token Consumption Policy
- **NEVER** call real paid APIs (OpenAI, DeepSeek, Anthropic) in tests.
- **NEVER** perform real billing transactions (Creem, Coinbase).
- **NEVER** download large files (YouTube) during tests.
- **Solution**: Use `unittest.mock` to intercept `transcriber.transcribe`, `summarizer.summarize`, and `video_processor.download`.

### 10.2 Database Isolation
- Backend tests run against a **MOCKED** database client (`db_client`).
- Do not assume a live Supabase connection in unit/integration tests unless strictly using a dedicated test environment (not configured currently).

### 10.3 Frontend Mocks
- Frontend tests run in `jsdom`.
- Mock `Next.js` Router (`useRouter`).
- Mock `ApiClient` responses.

---

## 11. Implementation Rules

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
*   [x] **Creem Integration** (Card payments without company registration)

---

## 12. Release Workflow (SOP)

Before merging or deploying code, follow this verification checklist:

### 12.1 Local Checks (Dev Loop)
1.  **Backend Logic**: If you touched Python code, run:
    ```bash
    uv run pytest
    ```
2.  **Frontend Components**: If you touched React components, run:
    ```bash
    cd frontend && npm test
    ```
3.  **Critical Path**: Before pushing, verify no regression in login/landing:
    ```bash
    cd frontend && npx playwright test
    ```

### 12.2 CI Gate (GitHub Actions)
- Pushing to `main` automatically triggers `.github/workflows/test.yml`.
- **Rule**: Do not deploy if CI is red.
- **Rule**: If CI fails, fix it locally first. Do not "fix in prod".

### 12.3 Dependency Management (Prevention)
- **Single Source of Truth**: Backend dependencies MUST be defined in the **ROOT** `requirements.txt`.
- **Reason**: GitHub Actions CI (`test.yml`) installs dependencies from the root `requirements.txt`.
- **Prohibited**: Do not create `backend/requirements.txt`. If you add a library locally (e.g. `uv pip install foo`), you MUST add it to the root `requirements.txt` immediately.
