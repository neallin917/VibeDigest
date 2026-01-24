"""
Centralized environment variable loader.
Priority: .env.local (secrets) > .env.production (shared config)
"""
from pathlib import Path
from dotenv import load_dotenv


def load_env():
    """
    Load environment variables from project root.
    Call this at the top of scripts before importing config.
    """
    # Find project root (parent of backend/)
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parent.parent
    project_root = backend_dir.parent

    env_production = project_root / ".env"
    env_local = project_root / ".env.local"

    # Load in order: shared config first, then local secrets overrides
    if env_production.exists():
        load_dotenv(dotenv_path=env_production)
    if env_local.exists():
        load_dotenv(dotenv_path=env_local, override=True)

    # Fallback: try legacy backend/.env if new files don't exist
    legacy_env = backend_dir / ".env"
    if not env_production.exists() and not env_local.exists() and legacy_env.exists():
        load_dotenv(dotenv_path=legacy_env)
