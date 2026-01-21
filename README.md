# VibeDigest

[中文版](./README_zh-CN.md)


**VibeDigest** is a modern, full-stack application designed to seamlessly download videos, transcribe audio, and generate AI-powered summaries. Engineered for performance and aesthetics, it leverages the power of OpenAI and the speed of Next.js.

## ✨ Key Highlights (v3)

- **Next-Gen Frontend**: Built with **Next.js 14+ (App Router)** and **TailwindCSS** for a responsive, fluid experience.
- **Premium UX**: A dark-mode-first design featuring "Supabase-style" glassmorphism and refined animations.
- **Advanced Backend**: Powered by **FastAPI** and the official **OpenAI API** for industry-leading transcription accuracy.
- **Robust Workflow**: Orchestrated by **LangGraph** for resilient, stateful task execution and error handling.
- **Real-time Updates**: Instant feedback on task progress via **Supabase Realtime**.

## 🚀 Features

- **Universal Video Support**: robust video downloading capabilities via `yt-dlp`.
- **Smart Processing**: Automatic audio extraction and intelligent chunking for large files.
- **Live Dashboard**: Watch your tasks progress from queue to completion in real-time.
- **Onboarding Demo**: New users see a live demo task to instantly understand the platform's capabilities.
- **Browser Notifications**: Get instant alerts when your tasks complete, even in the background.
- **Secure Authentication**: Integrated email and Google login support via Supabase Auth.
- **Multi-language UI (i18n)**: Built-in UI language switcher with RTL support for Arabic.
- **Flexible Pricing**: Hybrid model (Subscription + Pay-as-you-go) with Annual billing options and transparent usage tracking.
- **Payments (Optional)**: Card payments via Creem (no company registration required), and crypto checkout via Coinbase Commerce.

## 🛠 Technology Stack

### Frontend (The Thick Client)
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS, Framer Motion, Lucide React
- **Data**: Supabase Client & Custom API Client

### Backend (The Service Worker)
- **Core**: FastAPI (Python 3.10+)
- **Orchestration**: **LangGraph** (Stateful Graphs) + **LangChain** (LLM Interface)
- **AI Engine**: OpenAI API (Whisper)
- **Processing**: `yt-dlp` (Download), `pydub` (Audio manipulation)
- **Manager**: `uv` for fast Python package management

## 🎹 Vibe Coding (Development)

We provide a unified `Makefile` for a seamless "Vibe Coding" experience. Instead of remembering complex commands, use these simple shortcuts:

```bash
make help            # Show all available commands
make install         # Install all dependencies (backend + frontend)
make start-backend   # Start the backend locally
make start-frontend  # Start the frontend
make start-docker    # Start the full stack with Docker
make test            # Run all tests
```

## 🏁 Getting Started

### Prerequisites
- Python 3.10 or higher
- Node.js & npm
- Supabase Project
- OpenAI API Key

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-repo/ai-video-transcriber.git
    cd ai-video-transcriber
    ```

2.  **Backend Setup (Docker)**
    ```bash
    # Ensure Docker Desktop is running
    docker-compose up -d
    ```
    *Configure Environment*: Create `backend/.env` with:
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_KEY`
    - `SUPABASE_SERVICE_KEY`
    - `OPENAI_API_KEY`
    - `RESEND_API_KEY` (Optional, for Feedback emails)
    - `CREEM_API_KEY` (Optional, for Pricing / Creem Checkout)
    - `CREEM_WEBHOOK_SECRET` (Optional, for Creem webhook verification)
    - `COINBASE_API_KEY` (Optional, for Crypto Checkout)
    - `COINBASE_WEBHOOK_SECRET` (Optional, for Coinbase webhook verification)
    - `OPENAI_SUMMARY_MATCH_THRESHOLD` (Optional, default: 4.0. Lower = more timestamp matches, Higher = stricter)
    - `FRONTEND_URL` (Optional, used for payment redirect URLs; defaults to `http://localhost:3000`)

    > **Note**: If you update `requirements.txt`, run `docker-compose up --build -d transcriber-backend`.
    > **Tip**: For a detailed explanation of all environment variables, see [docs/backend/env.md](docs/backend/env.md).

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    ```
    *Configure Environment*: Create `frontend/.env.local` with:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Usage

1.  **Start the Backend Worker**
    The backend runs in the background via Docker.
    To view logs:
    ```bash
    docker logs -f transcriber-backend
    ```

    To restart the backend service:
    ```bash
    docker compose restart transcriber-backend
    ```

2.  **Launch the User Interface**
    From the `frontend` directory:
    ```bash
    npm run dev
    ```

3.  **Open your browser** to `http://localhost:3000`.

## 📖 Architecture Overview

The system operates on a **Control Plane vs. Data Plane** model:

-   **Control**: The frontend sends commands (like "Process Video") to the backend via HTTP.
-   **Data**: The backend updates the database. The frontend **never** waits for the HTTP response for status; it subscribes to the database changes. this ensures the UI is always in sync with the true state of the task.

## ⚡️ Performance & Caching Strategy (v2.1)

To provide instant results and save computation resources, VibeDigest implements an advanced deduplication and "Smart Resume" mechanism:

1.  **URL Normalization**:
    - The system automatically normalizes all incoming URLs (e.g., treating `youtu.be/xyz` and `youtube.com/watch?v=xyz` as the same video).
    - It strips noisy tracking parameters (like `utm_source`) to ensure cache hits for substantially identical content.

2.  **Task Deduplication (Cache Hit)**:
    - Checks if the video has **ever** been processed by **any** user.
    - **Instant Result**: If a match is found, the system instantly "clones" the existing script, summary, and audio results to the current user's task.

3.  **Smart Resume**:
    - If you request a video that has been processed but need a **different summary language**:
      - The system **skips** the expensive [Download] and [Transcribe] steps (reusing the existing script).
      - It only performs the lightweight [Translate/Summarize] step.
    - This reduces re-processing time from minutes to seconds.

## 🌍 i18n (UI Languages)

- **Supported locales**: `en`, `zh`, `es`, `ar`, `fr`, `ru`, `pt`, `hi`, `ja`, `ko`
- **Persistence**: stored in `localStorage` key `vd.locale`
- **RTL**: Arabic (`ar`) automatically sets `<html dir="rtl">`
- **Where users change language**:
  - `frontend/src/app/(main)/settings/page.tsx` (Settings → Language)
  - Public pages: Landing (`/`) and Login (`/login`) top-right
- **Developer notes**:
  - Source of truth: `frontend/src/lib/i18n.ts`
  - Hook: `useI18n()` from `frontend/src/components/i18n/I18nProvider.tsx`
  - If you add new UI strings, add keys in `messages.en` and provide translations for all supported locales.
  - **Smart Defaults**: The "New Task" form automatically selects the translation target language matching your current UI language preference.

## 🧱 Database Migrations (Supabase)

- **Pricing schema**: `backend/sql/01_pricing_schema.sql`
- **Payment orders (Creem + Coinbase)**: `backend/sql/02_payment_orders.sql`
- **Stripe to Creem migration**: `backend/sql/03_stripe_to_creem_migration.sql`

## 🧪 Running Tests

### Backend Tests (Pytest)
Runs `pytest` with a **REAL** transient Postgres database (via Docker/Testcontainers) for integration tests, mocking only the AI/External services.

**Requirements**:
- Docker Desktop must be running.

```bash
# Run from project root
export PYTHONPATH=backend
pytest -c backend/pytest.ini backend
```

### Frontend Tests (Vitest)
Runs component integration tests.
```bash
cd frontend
npm test
```

## 📄 License

This project is licensed under the terms found in the [LICENSE](LICENSE) file.

---
*For architectural details and contribution guidelines, developers should refer to `AGENTS.md`.*
