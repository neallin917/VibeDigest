# VibeDigest

**VibeDigest** is a modern, full-stack application designed to seamlessly download videos, transcribe audio, and generate AI-powered summaries. Engineered for performance and aesthetics, it leverages the power of OpenAI and the speed of Next.js.

## ✨ Key Highlights (v3)

- **Next-Gen Frontend**: Built with **Next.js 14+ (App Router)** and **TailwindCSS** for a responsive, fluid experience.
- **Premium UX**: A dark-mode-first design featuring "Supabase-style" glassmorphism and refined animations.
- **Advanced Backend**: Powered by **FastAPI** and the official **OpenAI API** for industry-leading transcription accuracy.
- **Real-time Updates**: Instant feedback on task progress via **Supabase Realtime**.

## 🚀 Features

- **Universal Video Support**: robust video downloading capabilities via `yt-dlp`.
- **Smart Processing**: Automatic audio extraction and intelligent chunking for large files.
- **Live Dashboard**: Watch your tasks progress from queue to completion in real-time.
- **Secure Authentication**: Integrated email and Google login support via Supabase Auth.
- **Multi-language UI (i18n)**: Built-in UI language switcher with RTL support for Arabic.

## 🛠 Technology Stack

### Frontend (The Thick Client)
- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: TailwindCSS, Framer Motion, Lucide React
- **Data**: Supabase Client & Custom API Client

### Backend (The Service Worker)
- **Core**: FastAPI (Python 3.10+)
- **AI Engine**: OpenAI API (Whisper)
- **Processing**: `yt-dlp` (Download), `pydub` (Audio manipulation)
- **Manager**: `uv` for fast Python package management

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

    > **Note**: If you update `requirements.txt`, run `docker-compose up --build -d transcriber-backend`.

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

## 📄 License

This project is licensed under the terms found in the [LICENSE](LICENSE) file.

---
*For architectural details and contribution guidelines, developers should refer to `AGENTS.md`.*
