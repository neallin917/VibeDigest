# VibeDigest

[中文版](./README_zh-CN.md)

**VibeDigest** is a modern, full-stack application designed to seamlessly download videos, transcribe audio, and generate AI-powered summaries. Engineered for performance and aesthetics, it leverages the power of OpenAI and the speed of Next.js.

## ⚡️ Quick Links

*   **For Developers**: [Contribution Guide](docs/CONTRIB.md) - Setup, installation, testing, and workflow.
*   **For Deployment**: [Runbook](docs/RUNBOOK.md) - Production deployment, monitoring, and troubleshooting.
*   **Full Documentation**: [docs/](docs/)

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

## 📖 Architecture Overview

The system operates on a **Control Plane vs. Data Plane** model:

-   **Control**: The frontend sends commands (like "Process Video") to the backend via HTTP.
-   **Data**: The backend updates the database. The frontend **never** waits for the HTTP response for status; it subscribes to the database changes. this ensures the UI is always in sync with the true state of the task.

For detailed architecture docs, see [docs/architecture/](docs/architecture/).

## ⚡️ Performance & Caching Strategy (v2.1)

To provide instant results and save computation resources, VibeDigest implements an advanced deduplication and "Smart Resume" mechanism:

1.  **URL Normalization**: Strips noisy parameters to ensure cache hits.
2.  **Task Deduplication (Cache Hit)**: Instantly "clones" existing results if the video has ever been processed by any user.
3.  **Smart Resume**: Reuses existing transcripts when requesting new summaries in different languages, reducing processing time from minutes to seconds.

## 🌍 i18n (UI Languages)

- **Supported locales**: `en`, `zh`, `es`, `ar`, `fr`, `ru`, `pt`, `hi`, `ja`, `ko`
- **Persistence**: stored in `localStorage` key `vd.locale`
- **RTL**: Arabic (`ar`) automatically sets `<html dir="rtl">`
- **Configuration**: See `frontend/src/lib/i18n.ts`.

## 📄 License

This project is licensed under the terms found in the [LICENSE](LICENSE) file.
