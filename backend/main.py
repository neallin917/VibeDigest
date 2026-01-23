import asyncio
import datetime
import hashlib
import hmac
import json
import logging
import os
import uuid
from pathlib import Path
from typing import Optional, List, Any
from urllib.parse import urlparse, urlunparse

from dotenv import load_dotenv

# Load environment variables before other local imports
# Priority: .env.local (secrets) > .env (shared config)
project_root = Path(__file__).parent.parent
env_local = project_root / ".env.local"
env_shared = project_root / ".env"

# Load in order: shared config first, then local overrides
if env_shared.exists():
    load_dotenv(dotenv_path=env_shared)
if env_local.exists():
    load_dotenv(dotenv_path=env_local, override=True)

import httpx
from coinbase_commerce.client import Client as CoinbaseClient
from coinbase_commerce.webhook import Webhook as CoinbaseWebhook
from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    HTTPException,
    UploadFile,
    File,
    Form,
    Header,
    BackgroundTasks,
    Depends,
    Body,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sentry_sdk

from config import settings
from db_client import DBClient
from notifier import Notifier
from supadata_client import SupadataClient
from summarizer import Summarizer
from transcriber import Transcriber, format_markdown_from_raw_segments
from translator import Translator
from video_processor import VideoProcessor
from utils.url import normalize_video_url
from workflow import app as workflow_app


# Langfuse V3 setup moved to Background Workers section below

# Configure Logging
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, log_level, logging.INFO))
logger = logging.getLogger(__name__)

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

app = FastAPI(title="VibeDigest API (v2)", version="2.0.0")


# No LangGraph schema needed - using AI SDK approach


@app.on_event("startup")
async def startup_event():
    logger.info(">>> VibeDigest Backend Starting <<<")
    logger.info(f"LLM Provider:  {settings.LLM_PROVIDER}")
    logger.info(
        f"Smart Model:   {settings.MODEL_ALIAS_SMART} (Temp: {settings.REASONING_TEMPERATURE})"
    )
    logger.info(
        f"Fast Model:    {settings.MODEL_ALIAS_FAST} (Temp: {settings.DEFAULT_TEMPERATURE})"
    )
    logger.info(f"OpenAI Base:   {settings.OPENAI_BASE_URL or 'Default'}")
    logger.info(">>> --------------------------- <<<")

    try:
        from langfuse import get_client

        lf = get_client()
        if lf:
            lf.flush()
    except:
        pass


# CORS Configuration
# Default to production and localhost
DEFAULT_ORIGINS = ["https://vibedigest.neallin.xyz", "http://localhost:3000"]
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

# Initialize Processors
# These instances are created once at startup and reused across requests.
video_processor = VideoProcessor()
transcriber = Transcriber()
summarizer = Summarizer()
translator = Translator()
db_client = DBClient()
notifier = Notifier()
supadata_client = SupadataClient()

# Creem API Config
CREEM_API_BASE = settings.CREEM_API_BASE
CREEM_API_KEY = settings.CREEM_API_KEY
CREEM_WEBHOOK_SECRET = settings.CREEM_WEBHOOK_SECRET

# Coinbase Config
coinbase_client = CoinbaseClient(api_key=settings.COINBASE_API_KEY)
COINBASE_WEBHOOK_SECRET = settings.COINBASE_WEBHOOK_SECRET


# Security Dependency
async def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    """Validate Bearer token and return user_id."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")

    user_id = db_client.validate_token(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")
    return user_id


@app.get("/")
async def read_root():
    return {"status": "VibeDigest API is running", "docs": "/docs"}


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and dev scripts."""
    return {"status": "healthy", "service": "vibedigest-backend"}


@app.post("/api/preview-video")
async def preview_video(
    url: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """
    Get video metadata without full processing.
    Used by chat tools to preview video before creating tasks.
    """
    try:
        # Normalize URL
        logger.info(f"Preview video request received for URL: {url}")
        normalized_url = normalize_video_url(url)

        if not normalized_url:
            logger.warning(f"Invalid URL received: {url}")
            raise HTTPException(status_code=400, detail="Invalid video URL")

        # Extract metadata only (no download)
        info = await video_processor.extract_info_only(normalized_url)

        return {
            "title": info.get("title", "Unknown"),
            "thumbnail": info.get("thumbnail", ""),
            "duration": info.get("duration", 0),
            "author": info.get("author", "Unknown"),
            "url": normalized_url,
            "description": info.get("description", ""),
            "upload_date": info.get("upload_date"),
            "view_count": info.get("view_count"),
        }

    except Exception as e:
        logger.error(f"Preview video failed: {e}")
        raise HTTPException(
            status_code=400, detail=f"Failed to preview video: {str(e)}"
        )


@app.get("/api/config")
async def get_config():
    """Endpoint removed for security."""
    raise HTTPException(status_code=404, detail="Not Found")


class FeedbackModel(BaseModel):
    category: str
    message: str
    contact_email: Optional[str] = None


# -------------------------------------------------------------------------
# API Endpoints
# -------------------------------------------------------------------------


@app.post("/api/process-video")
async def process_video(
    background_tasks: BackgroundTasks,
    video_url: str = Form(...),
    summary_language: str = Form(default="zh"),
    user_id: str = Depends(get_current_user),
):
    """
    Start a new video processing task (Optimized for low latency).
    1. Check Quota.
    2. Create Task.
    3. Offload all logic (cache check, output creation, processing) to background.
    """
    # Normalize URL if scheme is missing
    video_url = normalize_video_url(video_url)

    if not video_url:
        raise HTTPException(status_code=400, detail="Invalid video URL")

    # 0. Check Quota / Credits
    if not db_client.check_and_consume_quota(user_id):
        raise HTTPException(
            status_code=402,
            detail="Quota exceeded or insufficient credits. Please upgrade your plan.",
        )

    try:
        # 1. Create Task (Always create a new container)
        task = db_client.create_task(user_id=user_id, video_url=video_url)
        task_id = task["id"]

        # 1.1 Create Essential Placeholders (Synchronous)
        # This ensures UI has something to show immediately and satisfies integration tests.
        db_client.create_task_output(task_id, user_id, kind="script")
        db_client.create_task_output(
            task_id, user_id, kind="summary", locale=summary_language
        )
        db_client.create_task_output(
            task_id, user_id, kind="comprehension_brief", locale=summary_language
        )

        logger.info(
            f"Created task {task_id} for user {user_id}. Queuing background pipeline..."
        )

        # 2. Start Background Processing (pass user_id for output creation)
        background_tasks.add_task(
            run_pipeline, task_id, video_url, summary_language, user_id
        )

        return {"task_id": task_id, "message": "Task started"}

    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/retry-output")
async def retry_output(
    background_tasks: BackgroundTasks,
    output_id: str = Form(...),
    user_id: str = Depends(get_current_user),
):
    """Retry a specific output."""
    # TODO: Fetch output to verify ownership and get task_id.
    # For now, we assume ownership validation happens in DB (if RLS) or minimal trust.
    # Ideally db_client should have a get_output that checks user_id.

    # Reset status
    db_client.update_output_status(output_id, status="pending", progress=0, error="")

    # We need to know what task this belongs to, to re-run pipeline segments.
    # This logic requires fetching the output details first.
    # For simplicity v2 MVP, we'll implement a 'smart retry' that figures out what to do.
    # But strictly, we need to know the TASK ID + Kind.

    # We will defer full retry logic to a background job wrapper that looks up the output
    background_tasks.add_task(handle_retry_output, output_id, user_id)

    return {"message": "Retry queued"}


@app.post("/api/feedback")
async def submit_feedback(
    background_tasks: BackgroundTasks,
    feedback: FeedbackModel,
    authorization: Optional[str] = Header(None),
):
    """
    Submit user feedback/complaint.
    Allows anonymous submissions for landing page visitors.
    """
    # Try to get user_id from token, fallback to "anonymous" if not logged in
    user_id = "anonymous"
    if authorization:
        validated_user = db_client.validate_token(authorization)
        if validated_user:
            user_id = validated_user

    logger.info(
        f"FEEDBACK [{feedback.category}] from {user_id}: {feedback.message} (Contact: {feedback.contact_email})"
    )

    # Send email in background
    background_tasks.add_task(
        notifier.send_feedback_email,
        feedback.category,
        feedback.message,
        user_id,
        feedback.contact_email,
    )

    return {"status": "received", "message": "Thank you for your feedback!"}

    return {"status": "received", "message": "Thank you for your feedback!"}


@app.post("/api/webhook/creem")
async def creem_webhook(request: Request):
    """Handle Creem payment webhooks."""
    payload = await request.body()
    sig_header = request.headers.get("creem-signature")

    # Verify signature using HMAC-SHA256
    if CREEM_WEBHOOK_SECRET and sig_header:
        expected_sig = hmac.new(
            CREEM_WEBHOOK_SECRET.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, sig_header):
            logger.warning("Creem webhook signature verification failed")
            raise HTTPException(status_code=400, detail="Invalid signature")

    try:
        event = json.loads(payload.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = event.get("eventType")
    obj = event.get("object", {})

    logger.info(f"Creem webhook received: {event_type}")

    if event_type == "checkout.completed":
        # Extract data from checkout object
        checkout_id = obj.get("id")
        metadata = obj.get("metadata", {})
        user_id = metadata.get("user_id")
        customer = obj.get("customer", {})
        customer_id = customer.get("id") if isinstance(customer, dict) else customer
        order = obj.get("order", {})
        product = obj.get("product", {})
        subscription = obj.get("subscription", {})

        # Link Creem Customer ID (if we have user_id)
        if user_id and customer_id:
            db_client.link_creem_customer(user_id, customer_id)

        # Update payment order if exists
        if checkout_id:
            existing_order = db_client.get_payment_order_by_provider_id(checkout_id)
            if existing_order:
                if existing_order.get("status") == "completed":
                    logger.info(
                        f"Order {existing_order['id']} already completed. Skipping."
                    )
                    return {"status": "success", "message": "Already processed"}

                db_client.update_payment_order(
                    existing_order["id"],
                    status="completed",
                    metadata={
                        "creem_customer": customer_id,
                        "checkout_id": checkout_id,
                    },
                )

        # Determine product type
        billing_type = (
            product.get("billing_type", "one_time")
            if isinstance(product, dict)
            else "one_time"
        )
        product_id = product.get("id") if isinstance(product, dict) else product

        if billing_type == "recurring" and subscription:
            # Subscription purchase - activate Pro
            # Calculate period_end (Creem doesn't provide this directly, estimate from billing_period)
            billing_period = product.get("billing_period", "every-month")
            now = datetime.datetime.now(datetime.timezone.utc)
            if "year" in billing_period:
                period_end = now + datetime.timedelta(days=365)
            else:
                period_end = now + datetime.timedelta(days=30)

            if user_id:
                db_client.update_subscription_by_user(
                    user_id, "pro", period_end.isoformat()
                )
                logger.info(f"Activated Pro subscription for user {user_id}")

        else:
            # One-time payment (Credits)
            price = settings.get_price_by_id(product_id)
            if price and price.credits > 0 and user_id:
                db_client.add_credits(user_id, price.credits)
                logger.info(f"Added {price.credits} credits to user {user_id}")

    elif event_type == "subscription.paid":
        # Recurring payment success - renew subscription
        subscription = obj
        customer_id = subscription.get("customer")
        product = subscription.get("product", {})
        billing_period = (
            product.get("billing_period", "every-month")
            if isinstance(product, dict)
            else "every-month"
        )

        now = datetime.datetime.now(datetime.timezone.utc)
        if "year" in str(billing_period):
            period_end = now + datetime.timedelta(days=365)
        else:
            period_end = now + datetime.timedelta(days=30)

        if customer_id:
            db_client.update_subscription(customer_id, "pro", period_end.isoformat())
            logger.info(f"Renewed Pro subscription for customer {customer_id}")

    elif event_type in ("subscription.canceled", "subscription.expired"):
        # Subscription canceled or expired - downgrade to free
        subscription = obj
        customer_id = subscription.get("customer")

        if customer_id:
            # Set period_end to now to immediately downgrade
            db_client.update_subscription(
                customer_id,
                "free",
                datetime.datetime.now(datetime.timezone.utc).isoformat(),
            )
            logger.info(f"Canceled subscription for customer {customer_id}")

    return {"status": "success"}


@app.post("/api/create-crypto-charge")
async def create_crypto_charge(
    price_id: str = Form(...),  # We map price_id to amount manually for now
    user_id: str = Depends(get_current_user),
):
    """Create Coinbase Commerce Charge (USDC Only)."""

    price = settings.get_price_by_id(price_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid Price ID")

    amount = price.amount
    name = price.name

    try:
        # 2. Create Unified Order (Pending)
        order = db_client.create_payment_order(user_id, "coinbase", amount, "USD")
        if not order:
            raise HTTPException(status_code=500, detail="Failed to create order record")

        # 3. Create Coinbase Charge
        charge_data = {
            "name": name,
            "description": "VibeDigest Credits",
            "local_price": {"amount": str(amount), "currency": "USD"},
            "pricing_type": "fixed_price",
            "metadata": {
                "user_id": user_id,
                "order_id": order["id"],  # Link back to our DB
                "price_id": price_id,
            },
            "redirect_url": settings.FRONTEND_URL + "/settings/pricing?success=true",
            "cancel_url": settings.FRONTEND_URL + "/settings/pricing?canceled=true",
        }

        charge = coinbase_client.charge.create(**charge_data)
        hosted_url = charge.hosted_url
        code = charge.code

        # 4. Update Order with Charge Code
        db_client.update_payment_order(order["id"], provider_payment_id=code)

        return {"url": hosted_url}

    except Exception as e:
        logger.error(f"Coinbase creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhook/coinbase")
async def coinbase_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("X-CC-Webhook-Signature")

    try:
        event = CoinbaseWebhook.construct_event(
            payload.decode("utf-8"), sig_header, settings.COINBASE_WEBHOOK_SECRET
        )
    except Exception as e:
        logger.error(f"Coinbase signature error: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle confirmed payments
    if event.type == "charge:confirmed":
        charge = event.data
        metadata = charge.get("metadata", {})
        user_id = metadata.get("user_id")
        order_id = metadata.get("order_id")
        price_id = metadata.get("price_id")

        # Accounting Details
        payments = charge.get("payments", [])
        if payments:
            latest = payments[-1]
            crypto_amt = latest["value"]["crypto"]["amount"]
            crypto_curr = latest["value"]["crypto"]["currency"]

            # Verify Order
            if order_id:
                # Idempotency Check
                existing_order = db_client.get_payment_order(order_id)
                if existing_order and existing_order.get("status") == "completed":
                    logger.info(
                        f"Order {order_id} already completed. Skipping webhook."
                    )
                    return {"status": "success", "message": "Already processed"}

                db_client.update_payment_order(
                    order_id,
                    status="completed",
                    amount_crypto=float(crypto_amt),
                    currency_crypto=crypto_curr,
                    metadata=charge,
                )

        if user_id and price_id:
            price = settings.get_price_by_id(price_id)
            if price and price.credits > 0:
                db_client.add_credits(user_id, price.credits)
            # Handle Pro? (Manual period calculation needed if supporting crypto subs)
            pass

    return {"status": "success"}


# -------------------------------------------------------------------------
# Background Workers
# -------------------------------------------------------------------------

# Langfuse V3: propagate_attributes for automatic trace context
try:
    from langfuse import get_client as get_langfuse_client, propagate_attributes
except ImportError:

    def get_langfuse_client(*args: Any, **kwargs: Any) -> Any:
        return None

    from contextlib import contextmanager

    @contextmanager
    def propagate_attributes(**kwargs):
        yield


# Concurrency Control
# Limit concurrent heavy processing tasks to avoid OOM/CPU saturation.
# 20 requests will be queued in the event loop, but only 4 run at a time.
MAX_CONCURRENT_JOBS = 4
processing_limiter = asyncio.Semaphore(MAX_CONCURRENT_JOBS)


async def run_pipeline(task_id: str, video_url: str, summary_lang: str, user_id: str):
    """
    Main orchestration pipeline.
    Wrapped in a Semaphore to limit concurrency.
    Uses Langfuse propagate_attributes for automatic trace context propagation.
    """
    from contextlib import nullcontext

    async with processing_limiter:
        logger.info(
            f"Task {task_id} acquiring execution slot... (Active: {MAX_CONCURRENT_JOBS - processing_limiter._value})"
        )

        # Langfuse V3: Use propagate_attributes to set trace-level context
        # All child OpenAI calls will automatically inherit session_id, user_id, tags
        langfuse = get_langfuse_client()
        observation_ctx = (
            langfuse.start_as_current_observation(
                as_type="span",
                name="Video Processing Pipeline",
                input={"video_url": video_url, "summary_lang": summary_lang},
            )
            if langfuse
            else nullcontext()
        )

        with observation_ctx:
            with propagate_attributes(
                session_id=str(task_id), user_id=str(user_id), tags=["pipeline"]
            ):
                logger.info(
                    f"[Pipeline Start] Task={task_id}, URL={video_url}, Lang={summary_lang}"
                )

                try:
                    # Initialize input state
                    initial_state = {
                        "task_id": task_id,
                        "user_id": user_id,
                        "video_url": video_url,
                        "summary_lang": summary_lang,
                        "errors": [],
                        "cache_hit": False,
                        "is_youtube": False,
                    }

                    # Invoke Graph
                    await workflow_app.ainvoke(initial_state)

                except Exception as e:
                    logger.error(f"Pipeline crashed: {e}")
                    db_client.update_task_status(task_id, status="error", error=str(e))


async def handle_retry_output(output_id: str, user_id: str):
    """
    Handle logic for retrying a single output.
    Does NOT re-download video. Relies on existing Script output content if available.
    """
    try:
        out = db_client.get_output(output_id)
        if not out:
            return
        if out.get("user_id") != user_id:
            db_client.update_output_status(
                output_id, status="error", error="Not authorized"
            )
            return

        task_id = out.get("task_id")
        kind = out.get("kind")
        locale = out.get("locale")
        if not task_id or not kind:
            db_client.update_output_status(
                output_id, status="error", error="Invalid output"
            )
            return

        outputs = db_client.get_task_outputs(task_id)
        script_output = next((o for o in outputs if o.get("kind") == "script"), None)
        script_raw_output = next(
            (o for o in outputs if o.get("kind") == "script_raw"), None
        )

        if kind == "script":
            # Prefer re-formatting from persisted raw segments.
            if not script_raw_output or not script_raw_output.get("content"):
                db_client.update_output_status(
                    output_id,
                    status="error",
                    error="No raw transcript segments found; please create a new task to re-transcribe.",
                )
                return
            try:
                payload = json.loads(script_raw_output["content"])
                raw_segments = payload.get("segments", [])
                detected_language = payload.get("language", "unknown")
                md_with_ts = format_markdown_from_raw_segments(
                    raw_segments, detected_language=detected_language
                )
                clean = await summarizer.optimize_transcript(md_with_ts)
                db_client.update_output_status(
                    output_id, status="completed", progress=100, content=clean, error=""
                )
                return
            except Exception as e:
                db_client.update_output_status(
                    output_id, status="error", error=f"Reformat failed: {str(e)}"
                )
                return

        # For summary/translation, rely on existing script content.
        if not script_output or not script_output.get("content"):
            db_client.update_output_status(
                output_id, status="error", error="Missing script content; cannot retry."
            )
            return

        script_text = script_output["content"]
        # Keep the existing optimization step consistent.
        try:
            script_text = await summarizer.optimize_transcript(script_text)
        except Exception:
            pass

        if kind == "summary" or kind == "summary_source":
            task = db_client.get_task(task_id)
            video_title = (task or {}).get("video_title") or ""
            try:
                db_client.update_output_status(
                    output_id, status="processing", progress=30, error=""
                )
                # Always regenerate source-language summary first (stable, anchored).
                script_raw_json = None
                transcript_language = "unknown"
                try:
                    if script_raw_output and script_raw_output.get("content"):
                        script_raw_json = script_raw_output.get("content")
                        payload = json.loads(script_raw_json or "{}")
                        transcript_language = payload.get("language") or "unknown"
                except Exception:
                    script_raw_json = script_raw_json

                source_summary_json = (
                    await summarizer.summarize_in_language_with_anchors(
                        script_text,
                        summary_language=transcript_language,
                        video_title=video_title,
                        script_raw_json=script_raw_json,
                    )
                )

                # Ensure summary_source output exists (old tasks may not have it).
                summary_source_out = next(
                    (o for o in outputs if o.get("kind") == "summary_source"), None
                )
                if not summary_source_out:
                    try:
                        summary_source_out = db_client.create_task_output(
                            task_id, user_id, kind="summary_source"
                        )
                        # Refresh outputs list for downstream lookups
                        outputs = db_client.get_task_outputs(task_id)
                    except Exception as e:
                        logger.warning(
                            f"Failed to create summary_source output for task={task_id}: {e}"
                        )

                if summary_source_out:
                    db_client.update_output_status(
                        summary_source_out["id"],
                        status="completed",
                        progress=100,
                        content=source_summary_json,
                        error="",
                    )

                # Now fulfill the requested output.
                if kind == "summary_source":
                    db_client.update_output_status(
                        output_id,
                        status="completed",
                        progress=100,
                        content=source_summary_json,
                        error="",
                    )
                    return

                # kind == "summary": translate to requested locale if needed, preserving anchors.
                requested_lang = locale or transcript_language or "zh"
                if str(requested_lang).lower() != str(transcript_language).lower():
                    summary_json = await summarizer.translate_summary_json(
                        source_summary_json, target_language=requested_lang
                    )
                else:
                    summary_json = source_summary_json

                db_client.update_output_status(
                    output_id,
                    status="completed",
                    progress=100,
                    content=summary_json,
                    error="",
                )
            except Exception as e:
                db_client.update_output_status(output_id, status="error", error=str(e))
            return

        db_client.update_output_status(
            output_id, status="error", error=f"Retry not supported for kind: {kind}"
        )

    except Exception as e:
        db_client.update_output_status(output_id, status="error", error=str(e))


@app.patch("/api/tasks/{task_id}")
async def update_task_title(
    task_id: str, payload: dict = Body(...), user_id: str = Depends(get_current_user)
):
    """
    Update task details (title).
    Secure endpoint: checks ownership.
    """
    # 1. Verify Ownership
    task = db_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Update
    new_title = payload.get("video_title")
    if new_title:
        db_client.update_task_status(task_id, video_title=new_title)

    return {"status": "success"}


@app.post("/api/create-checkout-session")
async def create_checkout_session(
    price_id: str = Form(...),  # This is now Creem product_id
    user_id: str = Depends(get_current_user),
):
    """Create Creem Checkout Session."""
    price = settings.get_price_by_id(price_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid Product ID")

    try:
        # Create Creem Checkout Session via REST API
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{CREEM_API_BASE}/v1/checkouts",
                headers={
                    "x-api-key": CREEM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "product_id": price_id,
                    "success_url": settings.FRONTEND_URL
                    + "/settings/pricing?success=true",
                    "metadata": {"user_id": user_id},
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                error_detail = response.text
                logger.error(
                    f"Creem checkout creation failed: {response.status_code} - {error_detail}"
                )
                raise HTTPException(
                    status_code=500, detail=f"Checkout creation failed: {error_detail}"
                )

            checkout_data = response.json()
            checkout_url = checkout_data.get("checkout_url")
            checkout_id = checkout_data.get("id")

            if not checkout_url:
                raise HTTPException(status_code=500, detail="No checkout URL returned")

        # Create payment order for tracking
        amount_est = price.amount
        order = db_client.create_payment_order(user_id, "creem", amount_est, "USD")
        if order and checkout_id:
            db_client.update_payment_order(order["id"], provider_payment_id=checkout_id)

        return {"url": checkout_url}

    except httpx.RequestError as e:
        logger.error(f"Creem API request failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Payment service unavailable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Creem session creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "16080")))
