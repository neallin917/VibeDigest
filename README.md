# VibeDigest
🔗 [vibedigest.io](https://vibedigest.io)


[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](backend)
[![Next.js](https://img.shields.io/badge/next.js-14+-black.svg)](frontend)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](docker-compose.yml)

<p align="center">
  <img src="frontend/public/ai-video-summarizer-transcriber-og.png" alt="VibeDigest Banner" width="100%">
</p>

[中文版](./README.zh-CN.md)

**VibeDigest** is a modern, full-stack application designed to **download videos**, **transcribe audio**, and **generate AI-powered summaries**. Engineered for performance and aesthetics, it utilizes the power of OpenAI/LangChain and the speed of Next.js for a premium user experience.

Now featuring a **Chat-First Architecture** (v3.4) that puts conversation at the center of your learning workflow.

---

## ✨ Key Features

- **Chat-First Experience**: Interact with video content through a conversational interface. Ask questions, get summaries, and explore details naturally.
- **Universal Video Support**: Robust downloading via `yt-dlp` for YouTube, Bilibili, and podcast platforms (Xiaoyuzhou).
- **Smart Transcription**: Automatic audio extraction and intelligent chunking using OpenAI Whisper.
- **Supadata Integration**: Accelerated YouTube transcript fetching (optional) for near-instant results.
- **Interactive Timeline**: Clickable transcript blocks synchronized with video playback.
- **Seekable Playback**: Click-to-seek support for YouTube, Bilibili, and audio sources.
- **Live Dashboard**: Real-time task progress updates via **Supabase Realtime**.
- **Modern UI/UX**: Dark-mode-first design with glassmorphism, powered by TailwindCSS v4 and Framer Motion.
- **Secure Auth**: Integrated email and Google login support via Supabase Auth (Web2 only).
- **Internationalization**: Full i18n support including RTL layouts for Arabic.

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- **Node.js** (v20+)
- **Python** (3.10+)
- **Docker & Docker Compose**
- **Make** (standard on macOS/Linux)

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/VibeDigest.git
    cd VibeDigest
    ```

2.  **Configure Environment**:
    Create the local environment files.
    ```bash
    cp .env.example .env.local
    cp frontend/.env.production frontend/.env.local
    ```
    > **Note**: You will need to fill in `OPENAI_API_KEY`, `SUPABASE_URL`, etc., in `.env.local`.

3.  **Install Dependencies**:
    ```bash
    make install
    ```

### Running the App

Start the development services:

1.  **Start Backend** (Dockerized):
    ```bash
    make start-dev
    ```

2.  **Start Frontend** (Local):
    ```bash
    make start-frontend
    ```

Visit `http://localhost:3000` to see the app running.

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | Next.js 14, TypeScript, TailwindCSS v4, Framer Motion |
| **Backend** | Python 3.10+, FastAPI, LangGraph, LangChain |
| **Database** | PostgreSQL, Supabase (Realtime, Auth) |
| **AI/ML** | OpenAI API (Whisper, GPT-4), yt-dlp, pydub |
| **DevOps** | Docker, Make, uv (Python package manager) |

## 📖 Architecture Overview

The system operates on a **Control Plane vs. Data Plane** model:

-   **Control**: The frontend sends commands (like "Process Video") to the backend via HTTP.
-   **Data**: The backend updates the database. The frontend **never** waits for the HTTP response for status; it subscribes to the database changes. this ensures the UI is always in sync with the true state of the task.

For detailed architecture docs, see [AGENTS.md](AGENTS.md).

## ⚡️ Performance & Caching Strategy

To provide instant results and save computation resources, VibeDigest implements an advanced deduplication and "Smart Resume" mechanism:

1.  **Supadata Acceleration (Optional)**:
    *   For YouTube videos, the system can fetch transcripts directly via Supadata API (if configured), bypassing the expensive download/transcribe cycle.

2.  **URL Normalization**:
    *   Automatically strips noisy tracking parameters (e.g., `utm_source`) to ensure cache hits.
    *   Treats `youtu.be/xyz` and `youtube.com/watch?v=xyz` as the same resource.

3.  **Task Deduplication (Cache Hit)**:
    *   Checks if the video has been processed by **any** user.
    *   **Instant Results**: If found, instantly "clones" existing scripts, summaries, and audio to the current user without re-processing.

4.  **Smart Resume**:
    *   If you request a processed video but want a **different language** summary (e.g., have English, want Chinese):
        *   Skips expensive [Download] and [Transcription] steps.
        *   Only executes the lightweight [Translation/Summarization] step.
    *   Reduces processing time from minutes to seconds.

## 🌍 i18n (UI Languages)

- **Supported locales**: `en`, `zh`, `es`, `ar`, `fr`, `ru`, `pt`, `hi`, `ja`, `ko`
- **Persistence**: stored in `localStorage` key `vd.locale`
- **RTL**: Arabic (`ar`) automatically sets `<html dir="rtl">`
- **Configuration**: See `frontend/src/lib/i18n.ts`.


## 📚 Additional Resources

- **[Contribution Guide](CONTRIBUTING.md)**: Detailed workflow, coding standards, and testing procedures.
- **[Changelog](CHANGELOG.md)**: Version history and release notes.
- **[Security Policy](SECURITY.md)**: Vulnerability reporting and supported versions.
- **[Runbook](docs/RUNBOOK.md)**: Production deployment and monitoring.

## 🧱 Database Migrations (Supabase)

- **Pricing Schema**: `backend/sql/01_pricing_schema.sql`
- **Payment Orders (Creem + Coinbase)**: `backend/sql/02_payment_orders.sql`
- **Stripe to Creem Migration**: `backend/sql/03_stripe_to_creem_migration.sql`

## 🧪 Running Tests

### Full Suite (Recommended)
```bash
make test
```

### Backend Tests (Pytest)
Run `pytest` with mocked external services (safe & free).
```bash
# Run from project root
export PYTHONPATH=backend
pytest -c backend/pytest.ini backend
```

### Frontend Tests (Vitest)
Run component integration tests.
```bash
cd frontend
npm test
```

## 📄 License

This project is licensed under the terms found in the [LICENSE](LICENSE) file.

---
*For architecture details and contribution guidelines, developers should refer to [AGENTS.md](AGENTS.md).*
