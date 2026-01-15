# Project Context

## Purpose
VibeDigest is a full-stack tool engineered to download videos, transcribe audio, and generate AI-powered condensed knowledge. It transforms video content into seekable transcripts, structured summaries, and content timelines.

## Tech Stack
### Frontend
- **Framework**: Next.js 14+ (App Router, React 19)
- **Language**: TypeScript
- **Styling**: TailwindCSS v4, clsx, tailwind-merge, Framer Motion
- **Auth**: Supabase Auth (Email/Google)
- **Data Fetching**: Supabase Client (Realtime) + Custom ApiClient

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Orchestration**: LangGraph (Stateful Workflows), LangChain
- **Key Libraries**: openai, yt-dlp, pydub, resend, httpx
- **Package Manager**: uv

### Infrastructure
- **Database**: Supabase (PostgreSQL + Realtime)
- **Deployment**: Docker Compose, Traefik, Cloudflare Tunnel (Backend), Vercel (Frontend)

## Project Conventions

### Code Style
- **Frontend**:
  - Atomic Design for components (`src/components/ui/`).
  - Use `cva`, `clsx`, and `tailwind-merge` for styling; avoid raw Tailwind classes for variants.
  - Strict separation of Client Components (`"use client"`) and Server Components.
- **Backend**:
  - Dependency management via root `requirements.txt` only.
  - All Python commands must run with `uv`.

### Architecture Patterns
- **Control Plane vs. Data Plane**: Frontend triggers work via HTTP (Control), but waits for updates via Supabase Realtime (Data). Never poll the API.
- **LangGraph Workflow**: Submission -> Scheduling -> Graph Execution (Fetch -> Transcribe -> Summarize) -> DB Update.
- **"Prod is Sacred"**: Never test against the production database.

### Testing Strategy
- **Zero Token Consumption**: All automated tests must be cost-free. Mock all paid APIs (OpenAI, DeepSeek) and heavy network calls (YouTube downloads).
- **Backend**: `pytest` with mocked `db_client` and `transcriber`.
- **Frontend**: `npm test` (jsdom) and `npx playwright test` for critical paths.

### Git Workflow
- **CI/CD**: `main` branch triggers `.github/workflows/test.yml`.
- **Local Checks**: Must run `uv run pytest` and `npm test` before pushing.
- **Release**: Do not deploy if CI is red.

## Domain Context
- **Vibe Aesthetic**: Dark Mode (`#1C1C1C`), Emerald Green Accents, Glassmorphism.
- **Searchable Transcripts**: Full scripts are rendered as clickable timeline blocks.
- **Dual processing**: Supports direct YT download or Supadata fallback.

## Important Constraints
- **Auth**: Web2 only (Web3 login removed).
- **Cost Control**: `profiles` table tracks usage credits; automated tests must not incur costs.
- **Dependencies**: Do not create `backend/requirements.txt`; use the root one.

## External Dependencies
- **Supabase**: Auth, Database, Realtime, Storage (limited).
- **OpenAI**: Transcription (Whisper) and Summarization (LLM).
- **Resend**: Email notifications.
- **Supadata**: Optional fallback for YouTube transcripts.
