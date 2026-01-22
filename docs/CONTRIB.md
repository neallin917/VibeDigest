# Contribution Guide

## Development Workflow

1.  **Clone & Configure**
    ```bash
    git clone <repo>
    cp .env.example .env
    # Configure keys in .env (OpenAI, Supabase, etc.)
    ```

2.  **Install Dependencies**
    ```bash
    make install
    ```
    This installs Python requirements for the backend and npm packages for the frontend.

3.  **Start Development Environment**
    ```bash
    make start-dev
    ```
    Starts the backend in Docker with hot-reloading and the frontend locally.

4.  **Testing**
    *   **All Tests:** `make test`
    *   **Backend:** `make test-backend` (Pytest)
    *   **Frontend:** `make test-frontend` (Vitest)

5.  **Code Quality**
    *   **Lint:** `make lint`
    *   **Format:** Prettier (Frontend) / Ruff (Backend - auto-checked on commit if hooks enabled)

## Scripts Reference

### Global Commands (Makefile)

| Command | Description |
| :--- | :--- |
| `make install` | Install all dependencies (backend & frontend). |
| `make start-dev` | Start backend (Docker w/ reload) & frontend. |
| `make start-prod` | Start backend (Docker prod image) & frontend. |
| `make test` | Run unit & integration tests. |
| `make lint` | Run linters. |
| `make clean` | Remove temp files (`__pycache__`, etc.). |
| `make deploy` | Build production image and start prod containers. |

### Frontend Commands (frontend/package.json)

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `python3 ../scripts/workspace_dev.py` | Dev server with workspace management. |
| `dev:next` | `next dev` | Standard Next.js dev server. |
| `build` | `next build` | Production build. |
| `start` | `next start` | Start production server. |
| `test` | `vitest` | Run unit tests. |
| `lint` | `eslint` | Run ESLint. |

## Environment Setup

### Backend (.env)

The application requires a `.env` file in the root directory. See `.env.example` for the template.

**Critical Variables:**

*   **LLM Provider:** `OPENAI_API_KEY` (or custom provider config).
*   **Database:** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `DATABASE_URL`.
*   **Authentication:** `SUPABASE_KEY` (Anon), `SUPABASE_SERVICE_KEY` (Service Role).
*   **Frontend:** `FRONTEND_URL` (CORS and redirects).

### Frontend

Frontend environment variables are handled via Next.js and often mirror the root configuration or use `NEXT_PUBLIC_` prefixes where exposed.

## Git Workflow

*   **Branching:** `feat/feature-name`, `fix/issue-description`.
*   **Commits:** Conventional Commits (`feat: ...`, `fix: ...`).
*   **PRs:** Require CI pass (tests + lint) before merge.

## 🧱 Database Migrations

The project uses raw SQL files for Supabase migrations, located in `backend/sql/`.

*   **Pricing schema:** `backend/sql/01_pricing_schema.sql`
*   **Payment orders (Creem + Coinbase):** `backend/sql/02_payment_orders.sql`
*   **Stripe to Creem migration:** `backend/sql/03_stripe_to_creem_migration.sql`
