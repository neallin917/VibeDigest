import os
from pathlib import Path

from loguru import logger

from utils.logging import configure_logging
from utils.env_loader import load_env

# Load environment variables before other local imports.
# Priority: shell env > .env.local > .env (shell vars are never overridden)
load_env()

configure_logging()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from api.routes import system, tasks, webhooks, payments, models

if settings.SENTRY_DSN:
    import sentry_sdk
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

app = FastAPI(title="VibeDigest API (v2)", version="2.0.0")

@app.on_event("startup")
async def startup_event():
    from utils.model_registry import get_model_registry
    registry = get_model_registry()
    provider_cfg = registry.get_provider(settings.LLM_PROVIDER)
    resolved_smart = provider_cfg.get("defaults", {}).get("smart") if provider_cfg else settings.MODEL_ALIAS_SMART
    resolved_fast = provider_cfg.get("defaults", {}).get("fast") if provider_cfg else settings.MODEL_ALIAS_FAST

    # Fail-fast: require SUPABASE_JWT_SECRET in production
    dev_bypass = os.getenv("DEV_AUTH_BYPASS", "").strip().lower() in {"1", "true", "yes"}
    if not settings.MOCK_MODE and not dev_bypass and not settings.SUPABASE_JWT_SECRET:
        raise RuntimeError(
            "SUPABASE_JWT_SECRET is required when MOCK_MODE and DEV_AUTH_BYPASS are disabled. "
            "Set it to your Supabase project's JWT secret (Settings → API → JWT Secret)."
        )

    logger.info(">>> VibeDigest Backend Starting <<<")
    logger.info(f"LLM Provider:  {settings.LLM_PROVIDER}")
    logger.info(
        f"Smart Model:   {resolved_smart} (Temp: {settings.REASONING_TEMPERATURE})"
    )
    logger.info(
        f"Fast Model:    {resolved_fast} (Temp: {settings.DEFAULT_TEMPERATURE})"
    )
    logger.info(f"OpenAI Base:   {settings.OPENAI_BASE_URL or 'Default'}")
    logger.info(f"JWT Secret:    {'configured' if settings.SUPABASE_JWT_SECRET else 'MISSING'}")
    logger.info(">>> --------------------------- <<<")

    try:
        from langfuse import get_client

        lf = get_client()
        if lf:
            lf.flush()
    except Exception:
        pass

# CORS Configuration
# Default to production and localhost
DEFAULT_ORIGINS = [
    "https://vibedigest.io",
    "https://www.vibedigest.io",
    "http://localhost:3000",
]
# Allow override via env (comma-separated), fallback to defaults if not set.
env_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [
    o.strip() for o in env_origins.split(",") if o.strip()
] or DEFAULT_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Project Paths
PROJECT_ROOT = Path(__file__).parent.parent
TEMP_DIR = PROJECT_ROOT / "temp"
TEMP_DIR.mkdir(exist_ok=True)

# Include Routers
app.include_router(system.router, tags=["System"])
app.include_router(tasks.router, prefix="/api", tags=["Tasks"])
app.include_router(payments.router, prefix="/api", tags=["Payments"])
app.include_router(webhooks.router, prefix="/api/webhook", tags=["Webhooks"])
app.include_router(models.router, prefix="/api", tags=["Models"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "16080")))
