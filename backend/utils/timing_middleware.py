"""
Request timing middleware for local development.

Logs response time for each API request and adds an X-Response-Time
header. Production monitoring uses Sentry APM (100% sample rate).
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from loguru import logger

# High-frequency paths excluded from timing logs
EXCLUDED_PATHS = {"/health", "/favicon.ico"}


class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXCLUDED_PATHS:
            return await call_next(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        logger.info(
            f"{request.method} {request.url.path} "
            f"{response.status_code} {duration_ms:.1f}ms"
        )
        response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"
        return response
