import os
import logging
from typing import Dict, Optional
from pydantic import BaseModel


def _parse_bool_env(name: str, default: bool = False) -> bool:
    """
    Parse a boolean environment variable with common truthy/falsy values.

    Truthy: "1", "true", "t", "yes", "y", "on" (case-insensitive)
    Falsy: "0", "false", "f", "no", "n", "off" (case-insensitive)

    Returns the default if the env var is not set or has an unrecognized value.

    Note: This is inlined here to avoid circular imports with utils.text_utils.
    """
    raw = os.getenv(name)
    if raw is None:
        return bool(default)
    s = str(raw).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "on"):
        return True
    if s in ("0", "false", "f", "no", "n", "off"):
        return False
    return bool(default)

class PriceConfig(BaseModel):
    id: str
    amount: float
    name: str
    credits: int = 0
    mode: str = 'payment' # 'payment' or 'subscription'

class Settings:
    # Services
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    
    # Creem Payment
    CREEM_API_KEY: str = os.getenv("CREEM_API_KEY", "")
    CREEM_WEBHOOK_SECRET: str = os.getenv("CREEM_WEBHOOK_SECRET", "")
    CREEM_API_BASE: str = os.getenv("CREEM_API_BASE", "https://api.creem.io")  # Use https://test-api.creem.io for test mode
    
    # Coinbase
    COINBASE_API_KEY: str = os.getenv("COINBASE_API_KEY", "")
    COINBASE_WEBHOOK_SECRET: str = os.getenv("COINBASE_WEBHOOK_SECRET", "")

    # Langfuse
    LANGFUSE_PUBLIC_KEY: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    LANGFUSE_SECRET_KEY: str = os.getenv("LANGFUSE_SECRET_KEY", "")
    LANGFUSE_HOST: str = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
    
    # LangSmith
    LANGCHAIN_TRACING_V2: str = os.getenv("LANGCHAIN_TRACING_V2", "false")
    LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY") or ""
    LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT") or os.getenv("LANGSMITH_PROJECT") or "default"

    # Monitoring
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

    # Database
    POSTGRES_URI: str = os.getenv("POSTGRES_URI", "postgresql://postgres:password@postgres:5432/langgraph")

    # Models
    # Chat Agent Model
    MOCK_MODE: bool = _parse_bool_env("MOCK_MODE", False)

    # Cognition Rate Limiting (Local/Dev)
    # Default to TRUE for safety if env var invalid
    COGNITION_SEQUENTIAL: bool = _parse_bool_env("COGNITION_SEQUENTIAL", True)
    COGNITION_DELAY: float = float(os.getenv("COGNITION_DELAY") or "0.0")
    
    # LLM Configuration
    LLM_PROVIDER: str = (os.getenv("LLM_PROVIDER") or "openai").lower()
    OPENAI_BASE_URL: Optional[str] = os.getenv("OPENAI_BASE_URL")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")

    # Provider-specific default models (change LLM_PROVIDER to switch all at once)
    _PROVIDER_DEFAULTS = {
        "openai": {"smart": "gpt-4o", "fast": "gpt-4o-mini"},
        "custom": {"smart": "openai/gemini-3-pro-high", "fast": "openai/gemini-3-flash"}
    }

    # Model Aliases: Auto-select based on provider, or override via .env
    _defaults = _PROVIDER_DEFAULTS.get(LLM_PROVIDER, _PROVIDER_DEFAULTS["openai"])
    MODEL_ALIAS_SMART: str = os.getenv("MODEL_ALIAS_SMART") or _defaults["smart"]
    MODEL_ALIAS_FAST: str = os.getenv("MODEL_ALIAS_FAST") or _defaults["fast"]

    # --- Functional Mappings ---
    
    # Chat: Use Smart
    OPENAI_MODEL: str = MODEL_ALIAS_SMART
    
    # Comprehension: Use Smart (List format for fallback support)
    OPENAI_COMPREHENSION_MODELS: list[str] = [MODEL_ALIAS_SMART]

    # Sub-tasks: Use Fast
    OPENAI_SUMMARY_MODELS: list[str] = [MODEL_ALIAS_FAST]
    OPENAI_TRANSLATION_MODEL: str = MODEL_ALIAS_FAST
    OPENAI_HELPER_MODEL: str = MODEL_ALIAS_FAST
    
    # --- LLM Generation Defaults ---
    DEFAULT_TEMPERATURE: float = 0.1  # Default for most tasks
    REASONING_TEMPERATURE: float = 1.0 # Default for reasoning models (gpt-5/o1)
    
    # Token Limits (Sensible Defaults)
    DEFAULT_MAX_TOKENS: int = 4000
    SHORT_TASK_MAX_TOKENS: int = 1000
    LONG_TASK_MAX_TOKENS: int = 16000
    
    # Feature Flags
    USE_JSON_MODE: bool = True # Global flag to enable JSON mode where applicable

    def get_temperature(self, model_name: str) -> float:
        """
        Smart routing for temperature.
        Reasoning models (Smart tier) often require temp=1.0.
        Utility models (Fast tier) usually prefer low temp for stability.
        """
        # If it's the Smart model, or explicitly an o1/gpt-5 variant
        if model_name == self.MODEL_ALIAS_SMART or "gpt-5" in model_name or "o1-" in model_name:
            return self.REASONING_TEMPERATURE
        return self.DEFAULT_TEMPERATURE

    # Transcription Models
    # Defaulting to whisper-1 for now, but ready to switch to gpt-4o-transcribe
    OPENAI_TRANSCRIPTION_MODEL: str = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")

    # Summary Strategy
    # 'legacy' - Use the original generic prompt (default)
    # 'v2_classified' - Use 3-layer classification system (content_form, info_structure, cognitive_goal)
    SUMMARY_STRATEGY: str = os.getenv("SUMMARY_STRATEGY", "legacy")

    def __init__(self):
        # Log strategy on init to confirm loading
        logging.info(f"Config Loaded. SUMMARY_STRATEGY='{self.SUMMARY_STRATEGY}'")

    # Pricing / Plans (Creem Product IDs)
    PRICES: Dict[str, PriceConfig] = {
        "CREDIT_PACK": PriceConfig(
            id="prod_5VVI5ldN9dtI7tbHaST5OB",
            amount=5.00,
            name="50 Credits Top-up (One-time)",
            credits=50,
            mode='payment'
        ),
        "PRO_MONTHLY": PriceConfig(
            id="prod_5XoWWMZN6ptDexocrwyqT0",
            amount=9.90,
            name="Pro Plan (1 Month)",
            mode='subscription'
        ),
        "PRO_ANNUAL": PriceConfig(
            id="prod_1pLnYf7AwktcAhRhkjiJTh",
            amount=99.00,
            name="Pro Plan (1 Year)",
            mode='subscription'
        )
    }

    # Progress Constants
    class Progress:
        CREATED = 0
        PROCESSING_START = 10
        FETCHING_TRANSCRIPT = 20
        DOWNLOADING = 30
        TRANSCRIBING = 40
        SUMMARIZING_SOURCE = 60 # Implicit in code often
        COMPLETED = 100

    @classmethod
    def get_price_by_id(cls, price_id: str) -> Optional[PriceConfig]:
        for price in cls.PRICES.values():
            if price.id == price_id:
                return price
        return None

settings = Settings()
