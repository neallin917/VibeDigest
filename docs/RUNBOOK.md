# Runbook

## Deployment Procedures

The application uses Docker Compose for orchestration.

### Production Deployment

1.  **Build & Deploy**
    ```bash
    make deploy
    ```
    This command:
    1.  Builds the production Docker image (`transcriber-backend:prod`) using `release-prod`.
    2.  Starts containers using `docker-compose.prod.yml`.

2.  **Verify Status**
    ```bash
    docker ps
    # Check logs
    docker logs vibe-digest-backend
    ```

### Environment Configuration

Ensure the `.env` file is populated on the production server.

**Key Production Settings:**
*   `MOCK_MODE=false`
*   `LOG_LEVEL=INFO` (or `WARN`)
*   `LLM_PROVIDER=openai` (Ensure valid quota)

## Monitoring & Observability

### Logging
*   **Container Logs:** `docker logs -f <container_id>`
*   **Log Level:** Controlled via `LOG_LEVEL` env var.

### Sentry (Error Tracking)
*   **DSN:** Configured via `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`.
*   Captures unhandled exceptions in both Backend (FastAPI) and Frontend (Next.js).

### LLM Tracing (LangSmith / LangFuse)
*   **LangSmith:** Enabled if `LANGCHAIN_TRACING_V2=true`. Tracks chain execution latency and token usage.
*   **LangFuse:** Enabled via `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`.

## Common Issues & Fixes

### 1. Database Connection Failures
*   **Symptom:** 500 Errors, "Connection refused".
*   **Check:** `DATABASE_URL` format. Ensure it points to the connection pooler (port 6543) for transactional workloads if using Supabase.
*   **Fix:** Verify Supabase project status and IP allowlists.

### 2. LLM Rate Limits
*   **Symptom:** 429 Errors from OpenAI.
*   **Check:** `OPENAI_API_KEY` quota usage.
*   **Fix:** Rotate keys or request quota increase. Switch providers via `LLM_PROVIDER` if necessary.

### 3. Docker Container Crashes
*   **Symptom:** Container exits immediately.
*   **Check:** `docker logs <container>`. Often due to missing mandatory env vars (e.g., `SUPABASE_SERVICE_KEY`).

## Rollback Procedures

If a deployment fails:

1.  **Revert Code**
    ```bash
    git revert HEAD
    git push origin main
    ```

2.  **Redeploy Previous Image**
    If the previous image tag is preserved:
    ```bash
    # (Optional) Retag previous image if versioned
    docker stop <container>
    docker run -d <previous_image>
    ```
    *Currently, `make deploy` overwrites `transcriber-backend:prod`. For safer rollbacks, implement semantic versioning for docker images.*

3.  **Restart Services**
    ```bash
    make restart-prod
    ```
