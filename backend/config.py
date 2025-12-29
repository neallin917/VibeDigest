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
    
    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
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
        os.getenv("OPENAI_SUMMARY_MODEL_PREFERRED", "gpt-5.2"),
        "gpt-5",
        "gpt-5-mini",
        "gpt-5-nano",
        "gpt-4.1",
        "gpt-4o",
    ]
    
    # Helper Models (for simpler tasks like JSON repair, formatting)
    OPENAI_HELPER_MODEL: str = os.getenv("OPENAI_HELPER_MODEL", "gpt-5-mini")
    
    # Translation Models
    OPENAI_TRANSLATION_MODEL: str = os.getenv("OPENAI_TRANSLATION_MODEL", "gpt-4o")

    # Transcription Models
    # Defaulting to whisper-1 for now, but ready to switch to gpt-4o-transcribe
    OPENAI_TRANSCRIPTION_MODEL: str = os.getenv("OPENAI_TRANSCRIPTION_MODEL", "whisper-1")

    # Pricing / Plans
    # Using a dictionary for easy lookup by ID if needed, or just constants
    PRICES: Dict[str, PriceConfig] = {
        "CREDIT_PACK": PriceConfig(
            id="price_1ShU6pP16NRNsVf5EdlEFgOE",
            amount=5.00,
            name="20 Credits Top-up (One-time)",
            credits=20,
            mode='payment'
        ),
        "PRO_MONTHLY": PriceConfig(
            id="price_1ShU6GP16NRNsVf5dcAqHHDV",
            amount=9.90,
            name="Pro Plan (1 Month)",
            mode='subscription'
        ),
        "PRO_ANNUAL": PriceConfig(
            id="price_1ShVNXP16NRNsVf56kArMPa4",
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
