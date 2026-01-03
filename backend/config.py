import os
from typing import Dict, Optional
from pydantic import BaseModel

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

    # Monitoring
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")

    # Models
    # OpenAI Models
    # Summary & Analysis Chain (Preferred -> Fallback)
    OPENAI_SUMMARY_MODELS: list[str] = [
        os.getenv("OPENAI_SUMMARY_MODEL_PREFERRED", "gpt-4o-mini"), # V2 策略推荐模型 (gpt-5 系列在长文本摘要中表现不佳)
        "gpt-4o",
        "gpt-5.2",
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
        "gpt-4.1",
    ]
    
    # Helper Models (for simpler tasks like JSON repair, formatting)
    OPENAI_HELPER_MODEL: str = os.getenv("OPENAI_HELPER_MODEL", "gpt-5-mini")
    
    # Translation Models
    OPENAI_TRANSLATION_MODEL: str = os.getenv("OPENAI_TRANSLATION_MODEL", "gpt-4.1-mini")

    # Transcription Models
    # Defaulting to whisper-1 for now, but ready to switch to gpt-4o-transcribe
    OPENAI_TRANSCRIPTION_MODEL: str = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")

    # Summary Strategy
    # 'legacy' - Use the original generic prompt (default)
    # 'v2_classified' - Use 3-layer classification system (content_form, info_structure, cognitive_goal)
    SUMMARY_STRATEGY: str = os.getenv("SUMMARY_STRATEGY", "legacy")

    # Pricing / Plans (Creem Product IDs)
    PRICES: Dict[str, PriceConfig] = {
        "CREDIT_PACK": PriceConfig(
            id="prod_lcSEEQdt57GWImjDUwYrX",
            amount=5.00,
            name="50 Credits Top-up (One-time)",
            credits=50,
            mode='payment'
        ),
        "PRO_MONTHLY": PriceConfig(
            id="prod_3lXRz2ypke2tUAIbsbrdvv",
            amount=9.90,
            name="Pro Plan (1 Month)",
            mode='subscription'
        ),
        "PRO_ANNUAL": PriceConfig(
            id="prod_2rOdq3nC3kDbAPEO47eYKl",
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
