# Environment Variables Guide

This project uses environment variables to configure the backend application.
These variables are defined in a `.env` file in the `backend/` directory.

## Setup

1.  **Copy the Template:**
    Copy the example file to create your local configuration:
    ```bash
    cp .env.example .env
    ```

2.  **Fill in Secrets:**
    Open `.env` and fill in the required API keys (Supabase, OpenAI, etc.).

## Variable Groups

### 1. LLM Provider Configuration
Configures which AI model provider to use.
- `LLM_PROVIDER`: Options are `openai` (default) or `custom` (for LiteLLM, local, etc.).
- `OPENAI_API_KEY`: The API key for the provider.
- `OPENAI_BASE_URL`: The base URL for the API (e.g., `https://api.openai.com/v1`).
- `MODEL_ALIAS_*`: (Optional) Overrides for specific model names if using a custom provider.

### 2. Database & Core Services
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_KEY`: The Service Role key (needed for backend administrative tasks).
- `DATABASE_URL`: Connection string for the Postgres database (usually the Transaction Pooler URL).

### 3. Third-Party Integrations
- Keys for Resend (Email), Coinbase/Creem/Stripe (Payments), Supadata (Enrichment).
- Leave blank if the feature is not being used in development.

### 4. Observability
- Keys for Sentry (Error Tracking), Langfuse (LLM Tracing), and LangSmith (LangChain Tracing).
- Set `LOG_LEVEL` to `DEBUG` for verbose output during development.

### 5. Application Settings
- `FRONTEND_URL`: CORS origin URL for the frontend.
- `MOCK_MODE`: Set to `true` to mock external API calls for testing.
