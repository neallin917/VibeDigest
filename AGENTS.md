# AGENTS.md — VibeDigest

> **AI Agents**: This is the Single Source of Truth. Before writing code, READ this file. If you make architectural changes, UPDATE this file.

## Project

VibeDigest — Full-stack tool to download videos, transcribe audio, and generate AI-powered condensed knowledge.

## Core Rules

1. **Verify before declaring success** — Never say "this should work now". Run the build, run the tests, check the output.
2. **Explain before changing** — When diagnosing issues, provide explanation FIRST. Only edit code when explicitly asked or after confirming diagnosis.
3. **Cross-boundary validation** — After any refactor touching both frontend and backend, run: `cd frontend && npm run build` AND `make test-backend`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend (Next.js) |
| `npm run lint` | Lint frontend |
| `uv run main.py` | Start backend (FastAPI) |
| `uv run pytest` | Run backend tests |
| `docker-compose up -d` | Start full stack |

## Architecture (TL;DR)

- **Control Plane**: HTTP triggers work (`POST /api/process-video`)
- **Data Plane**: Supabase Realtime watches work (`supabase.channel`)
- **Rule**: Frontend NEVER polls HTTP. It subscribes to database changes.

## Critical Rules

1. **Python**: Always use `uv` (never raw `pip`)
2. **Dependencies**: Add to ROOT `requirements.txt` only (not `backend/`)
3. **Models**: Never hardcode LLM model names — use `ModelRegistry`
4. **Components**: Use CVA for variants, check `src/components/ui/` first
5. **Tests**: Never call paid APIs in CI (mock everything)

## Detailed Guidelines

| Topic | Guide |
|-------|-------|
| Architecture | [.claude/architecture.md](.claude/architecture.md) |
| Frontend | [.claude/frontend.md](.claude/frontend.md) |
| Backend | [.claude/backend.md](.claude/backend.md) |
| Database | [.claude/database.md](.claude/database.md) |
| Deployment | [.claude/deployment.md](.claude/deployment.md) |
| Testing | [.claude/testing.md](.claude/testing.md) |
| Release | [.claude/release.md](.claude/release.md) |
| Secrets | [.claude/secrets.md](.claude/secrets.md) |
| Commands | [.claude/commands.md](.claude/commands.md) |
| Git | [.claude/git.md](.claude/git.md) |

## Version History

See [docs/changelog.md](docs/changelog.md) for version history (v3.0 → v3.4).
