# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Rules

- When fixing bugs or making code changes, NEVER declare success until you have actually verified the fix works (run the build, run the tests, check the output). Do not say "this should work now" — prove it.
- When the user asks you to explain or diagnose something, provide the explanation FIRST before jumping to code changes. Only make edits when explicitly asked or after confirming the diagnosis with the user.
- After any refactor, run both frontend build (`cd frontend && npm run build`) and backend tests (`make test-backend`) to catch cross-boundary issues.

## Project Overview

VibeDigest is a full-stack video processing tool: download videos, transcribe audio, generate AI summaries. Chat-first interface (v3.4). See `AGENTS.md` for detailed architecture (SSOT for this project).

## Commands

### Build & Run

```bash
make install                 # Install all deps (backend via uv, frontend via npm)
make start-backend           # Local FastAPI on port 16081
make start-frontend          # Next.js dev on port 3000
make start-dev               # Docker backend (dev, hot reload)
```

### Testing

```bash
make test                    # Unit tests only: backend + frontend (fast, no real APIs)
make test-backend            # Backend unit tests (pytest -m "not integration and not slow")
make test-frontend           # Frontend unit tests (vitest)
make test-integration        # Backend integration tests (real APIs, requires .env.local)

# Single backend test file
PYTHONPATH=backend uv run pytest backend/tests/test_foo.py -v

# Single frontend test file
cd frontend && npx vitest run src/path/to/file.test.ts

# Frontend E2E (Playwright, runs on port 3001 with mock data)
cd frontend && npx playwright test e2e/workflow-complete.spec.ts

# Frontend with coverage
cd frontend && npm run test:cov
```

### Linting

```bash
cd frontend && npm run lint              # ESLint (flat config)
ruff check backend --select=E9,F63,F7,F82 --target-version=py310  # Strict errors
ruff check backend --exit-zero           # Warnings
```

### Other

```bash
make verify                  # Test LLM connection + workflow
make clean                   # Remove __pycache__, .pytest_cache, temp files
cd frontend && npm run build # Production build check
cd frontend && npm run generate-types    # Regenerate TS types from backend Pydantic models
```

## Architecture

### Control Plane vs. Data Plane

- **Control (HTTP)**: Frontend → Backend via `ApiClient.processVideo()` etc.
- **Data (Realtime)**: Backend writes to Supabase DB → Frontend subscribes via `supabase.channel`
- **Rule**: UI updates come from DB Realtime, never from HTTP response

### Backend (Python / FastAPI)

- `backend/main.py` — FastAPI entry, CORS, router registration
- `backend/workflow.py` — LangGraph state graph (check_cache → fetch_data → transcribe → summarize → classify)
- `backend/db_client.py` — Supabase service-role + SQLAlchemy
- `backend/api/routes/` — REST endpoints (tasks, payments, webhooks, models, system)
- `backend/services/` — Business logic (video_processor, transcriber, summarizer, translator, etc.)
- `backend/utils/` — Shared utilities (model_registry, llm_router, openai_client)
- `backend/configs/providers/*.yaml` — LLM provider/model definitions (SSOT, never hardcode model names)
- `backend/schemas/` — Pydantic models

### Frontend (Next.js 14+ / TypeScript / React 19)

- `frontend/src/app/[lang]/chat/` — Primary interface (Chat-First)
- `frontend/src/app/[lang]/(main)/` — Protected routes (settings, tasks)
- `frontend/src/components/chat/` — ChatWorkspace, ChatContainer, IconSidebar, LibrarySidebar, VideoDetailPanel
- `frontend/src/components/tasks/` — VideoEmbed, YouTubePlayer, TranscriptTimeline
- `frontend/src/lib/api.ts` — `ApiClient` class (static methods for HTTP commands)
- `frontend/src/lib/supabase.ts` — Supabase client (queries/realtime only, never triggers compute)
- `frontend/src/types/generated/` — Auto-generated from backend Pydantic models

### Key Boundaries

- **Commands (writes)** go through `ApiClient` → Backend HTTP
- **Queries (reads)** go through Supabase Client directly
- **Never** use ApiClient to poll; **never** use Supabase to trigger compute

## Conventions

### Backend (Python)

- Python with type hints, `snake_case` conventions
- All Python commands run with `uv` (e.g., `uv run pytest`, `uv pip install`)
- Dependencies go in **root** `requirements.txt` (not backend/), since CI installs from root
- `asyncio_mode=auto` in pytest; unit tests mock all external services (OpenAI, Supabase, Resend); integration tests may call real services
- Config via `backend/config.py`; model resolution via `ModelRegistry` from YAML configs
- `LLM_PROVIDER` env var selects provider; `MODEL_ALIAS_SMART`/`MODEL_ALIAS_FAST` override defaults

### Frontend (TypeScript)

- TypeScript strict mode, `camelCase` for JS/TS, Next.js App Router patterns
- Path alias: `@/*` → `frontend/src/*`
- Styling: TailwindCSS v4 + `cn()` utility (clsx + tailwind-merge). Use CVA for variants.
- i18n: `useI18n()` hook, locale in `localStorage('vd.locale')`, 10 supported locales
- Client Components needed for: Supabase client, ApiClient, hooks. Server Components for static shells.
- E2E tests use `NEXT_PUBLIC_E2E_MOCK=1` and `NEXT_DIST_DIR=.next-test` on port 3001
- ESLint relaxes `no-explicit-any` in test files

### Cross-Boundary (Frontend ↔ Backend)

- Backend uses `snake_case`, frontend uses `camelCase` — always check for mismatches at API boundaries
- After any refactor touching both sides, run `cd frontend && npm run build` AND `make test-backend`

### Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`
- Branch from `main` (e.g., `feat/user-auth`, `fix/login-bug`)

### Environment

- `.env` — Shared config (committed)
- `.env.local` — Secrets (gitignored, required for both backend + frontend)
- Ports: Frontend 3000, Backend dev 16081, Backend prod 16080

### Testing Rules

- **Unit tests** (`make test-backend`): Always mock external services (`unittest.mock` / Vitest mocks). No real network calls. Runs on every commit.
- **Integration tests** (`make test-integration`): May call real APIs and download real videos. Requires `.env.local`. Mark with `@pytest.mark.integration` — or place in `tests/integration/` / name file `test_manual_*.py` (auto-marked).
- **E2E tests** (Playwright): Run against real frontend on port 3001 with `NEXT_PUBLIC_E2E_MOCK=1`.
- Frontend tests run in jsdom; mock `useRouter`, `ApiClient`

## Before Committing

1. Run relevant tests (`make test-backend` / `make test-frontend`)
2. Run linting (`cd frontend && npm run lint`)
3. Verify build passes (`cd frontend && npm run build`)
4. Check `git diff --staged` for secrets before committing
