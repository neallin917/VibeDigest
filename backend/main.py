from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, BackgroundTasks, Depends, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import datetime
import logging
from pathlib import Path
from typing import Optional, List
import uuid
import json
import shutil
from urllib.parse import urlparse
from urllib.parse import urlunparse
from dotenv import load_dotenv
import stripe
from coinbase_commerce.client import Client as CoinbaseClient
from coinbase_commerce.webhook import Webhook as CoinbaseWebhook

# Load environment variables
load_dotenv()

from video_processor import VideoProcessor
from transcriber import Transcriber
from transcriber import format_markdown_from_raw_segments
from summarizer import Summarizer
from translator import Translator
from db_client import DBClient
from notifier import Notifier
from supadata_client import SupadataClient
from pydantic import BaseModel
from config import settings

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VibeDigest API (v2)", version="2.0.0")

# CORS Configuration
# Default to production and localhost
DEFAULT_ORIGINS = ["https://vibedigest.neallin.xyz", "http://localhost:3000"]
# Allow override via env (comma-separated), fallback to defaults if not set.
env_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [o.strip() for o in env_origins.split(",") if o.strip()] or DEFAULT_ORIGINS

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
video_processor = VideoProcessor()
transcriber = Transcriber()
summarizer = Summarizer()
translator = Translator()
db_client = DBClient()
notifier = Notifier()
supadata_client = SupadataClient()

# Stripe Config
stripe.api_key = settings.STRIPE_SECRET_KEY

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

    user_id: str = Depends(get_current_user)
):
    """
    Start a new video processing task.
    Creates 1 Task + N Outputs (Script, Summary, [Translations...]).
    """
    # Normalize URL if scheme is missing
    if not video_url.startswith(("http://", "https://")):
        video_url = f"https://{video_url}"

    # Normalize common hosts (best-effort). Some providers (e.g., Bilibili) are stricter about hostnames.
    try:
        parsed = urlparse(video_url)
        host = (parsed.hostname or "").lower()
        if host == "bilibili.com":
            # Prefer canonical hostname
            video_url = urlunparse(parsed._replace(netloc="www.bilibili.com"))
    except Exception:
        pass

    # 0. Check Quota / Credits
    if not db_client.check_and_consume_quota(user_id):
        raise HTTPException(status_code=402, detail="Quota exceeded or insufficient credits. Please upgrade your plan.")

    try:
        # 1. Create Task
        task = db_client.create_task(user_id=user_id, video_url=video_url)
        task_id = task['id']
        logger.info(f"Created task {task_id} for user {user_id}")

        # 2. Create Outputs (Script & Summary are default)
        outputs = []
        # Create an audio output for sites without video embedding (e.g. podcasts)
        # Stores only a direct URL (no Supabase Storage usage).
        audio_out = None
        try:
            host = urlparse(video_url).hostname or ""
            host = host.replace("www.", "")
            if host.endswith("xiaoyuzhoufm.com") or host.endswith("apple.com"):
                audio_out = db_client.create_task_output(task_id, user_id, kind="audio")
        except Exception:
            audio_out = None
        script_out = db_client.create_task_output(task_id, user_id, kind="script")
        # Internal output: persisted raw Whisper segments (JSON) for re-formatting without re-transcribing.
        script_raw_out = db_client.create_task_output(task_id, user_id, kind="script_raw")
        # Summary requested by user locale (rendered in UI)
        summary_out = db_client.create_task_output(task_id, user_id, kind="summary", locale=summary_language)
        # Stable summary in transcript/source language (used for accurate time anchoring + bilingual toggle)
        summary_source_out = db_client.create_task_output(task_id, user_id, kind="summary_source")
        if audio_out:
            outputs.append(audio_out)
        outputs.extend([script_out, script_raw_out, summary_out, summary_source_out])



        # 4. Start Background Processing
        background_tasks.add_task(run_pipeline, task_id, video_url, summary_language)

        return {"task_id": task_id, "message": "Task created successfully"}

    except Exception as e:
        logger.error(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/retry-output")
async def retry_output(
    background_tasks: BackgroundTasks,
    output_id: str = Form(...),
    user_id: str = Depends(get_current_user)
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
    user_id: str = Depends(get_current_user)
):
    """
    Submit user feedback/complaint.
    """
    logger.info(f"FEEDBACK [{feedback.category}] from {user_id}: {feedback.message} (Contact: {feedback.contact_email})")
    
    # Send email in background
    background_tasks.add_task(
        notifier.send_feedback_email,
        feedback.category,
        feedback.message,
        user_id,
        feedback.contact_email
    )
    
    return {"status": "received", "message": "Thank you for your feedback!"}

    return {"status": "received", "message": "Thank you for your feedback!"}

@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        mode = session.get('mode')
        cid = session.get('customer')
        user_id = session.get('client_reference_id')
        
        # Link Customer ID if present
        if user_id and cid:
            db_client.link_stripe_customer(user_id, cid)

        # Unified Order: Update to completed
        # We need to find the order. Stripe Session ID is in session['id']
        session_id = session['id']
        order = db_client.get_payment_order_by_provider_id(session_id)
        if order:
             if order.get('status') == 'completed':
                 logger.info(f"Order {order['id']} already completed. Skipping webhook.")
                 return {"status": "success", "message": "Already processed"}
                 
             db_client.update_payment_order(
                 order['id'], 
                 status='completed', 
                 metadata={"stripe_customer": cid, "mode": mode}
             )

        # Handle Line Items? Or just mode.
        # Ideally we check what was bought. 
        # For simplicity, we assume mode + metadata or lookup session items if needed.
        # But here we can check if it matches our Known Price IDs if expanded, 
        # or simplified logic:
        
        if mode == 'subscription':
            # This is a new subscription or update
            # We treat it as 'pro'
            # We need to get period_end from subscription object?
            # session has 'subscription' ID.
            sub_id = session.get('subscription')
            sub = stripe.Subscription.retrieve(sub_id)
            current_period_end = datetime.datetime.fromtimestamp(sub['current_period_end'])
            
            # Need to find user by customer_id if user_id is missing
            # (In recurring payments, client_reference_id might be missing in webhook?)
            # Actually invoice.payment_succeeded is better for recurring. 
            # checkout.session.completed is for the initial signup.
            
            if user_id:
                # First time signup
                db_client.update_subscription(cid, 'pro', current_period_end.isoformat())
                
        elif mode == 'payment':
            # One time payment (Credits)
            # Verify if it is the credit pack
            # We assume it is for now (MVP)
            if user_id:
                db_client.add_credits(user_id, 20)

    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        # Recurring payment success
        cid = invoice.get('customer')
        sub_id = invoice.get('subscription')
        
        if sub_id:
            sub = stripe.Subscription.retrieve(sub_id)
            current_period_end = datetime.datetime.fromtimestamp(sub['current_period_end'])
            # Renew Pro
            db_client.update_subscription(cid, 'pro', current_period_end.isoformat())

    return {"status": "success"}

@app.post("/api/create-crypto-charge")
async def create_crypto_charge(
    price_id: str = Form(...), # We map price_id to amount manually for now
    user_id: str = Depends(get_current_user)
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
            "local_price": {
                "amount": str(amount),
                "currency": "USD"
            },
            "pricing_type": "fixed_price",
            "metadata": {
                "user_id": user_id,
                "order_id": order['id'], # Link back to our DB
                "price_id": price_id
            },
            "redirect_url": settings.FRONTEND_URL + "/settings/pricing?success=true",
            "cancel_url": settings.FRONTEND_URL + "/settings/pricing?canceled=true",
        }
        
        charge = coinbase_client.charge.create(**charge_data)
        hosted_url = charge.hosted_url
        code = charge.code
        
        # 4. Update Order with Charge Code
        db_client.update_payment_order(order['id'], provider_payment_id=code)
        
        return {"url": hosted_url}
        
    except Exception as e:
        logger.error(f"Coinbase creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/webhook/coinbase")
async def coinbase_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("X-CC-Webhook-Signature")

    try:
        event = CoinbaseWebhook.construct_event(payload.decode('utf-8'), sig_header, settings.COINBASE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error(f"Coinbase signature error: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle confirmed payments
    if event.type == 'charge:confirmed':
        charge = event.data
        metadata = charge.get('metadata', {})
        user_id = metadata.get('user_id')
        order_id = metadata.get('order_id')
        price_id = metadata.get('price_id')
        
        # Accounting Details
        payments = charge.get('payments', [])
        if payments:
            latest = payments[-1]
            crypto_amt = latest['value']['crypto']['amount']
            crypto_curr = latest['value']['crypto']['currency']
            
            # Verify Order
            if order_id:
                # Idempotency Check
                existing_order = db_client.get_payment_order(order_id)
                if existing_order and existing_order.get('status') == 'completed':
                     logger.info(f"Order {order_id} already completed. Skipping webhook.")
                     return {"status": "success", "message": "Already processed"}

                db_client.update_payment_order(
                    order_id, 
                    status='completed', 
                    amount_crypto=float(crypto_amt),
                    currency_crypto=crypto_curr,
                    metadata=charge
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

async def run_pipeline(task_id: str, video_url: str, summary_lang: str):
    """
    Main orchestration pipeline.
    1. Download Video
    2. Transcribe (updates Script output)
    3. Summarize (updates Summary output)
    4. Translate (updates Translation outputs)
    """
    try:
        # Update Task Status
        db_client.update_task_status(task_id, status="processing", progress=10)

        # Try Supadata first if it's a supported URL (YouTube usually)
        # We can try for all, let the client decide or handle error.
        supadata_result = None
        
        # Simple heuristic to prioritize Supadata for YouTube
        is_youtube = "youtube.com" in video_url or "youtu.be" in video_url
        if is_youtube:
            try:
                # 30% progress for "Fetching Transcript"
                db_client.update_task_status(task_id, status="processing", progress=20)
                md, raw, lang = await supadata_client.get_transcript_async(video_url)
                if md and raw:
                    supadata_result = (md, raw, lang)
                    logger.info("Supadata transcript fetched successfully.")
            except Exception as e:
                logger.warning(f"Supadata attempt failed: {e}")

        audio_path = None
        video_title = "Unknown"
        thumbnail_url = None
        direct_audio_url = None
        
        if supadata_result:
            # OPTION A: Supadata Succeeded.
            # We skip heavy download. But we need Metadata (Title, Thumb, AudioURL).
            logger.info("Using Supadata result. Fetching metadata only...")
            try:
                # Quick metadata fetch
                video_title, thumbnail_url, direct_audio_url = await video_processor.extract_info_only(video_url)
                # Update DB
                db_client.update_task_status(task_id, progress=30, video_title=video_title, thumbnail_url=thumbnail_url)
            except Exception as e:
                # If metadata fails, we might technically proceed with "Unknown" title?
                # But safer to maybe fallback to full download flow if we really need consistent state?
                # For now, log and proceed with what we have.
                logger.error(f"Metadata fetch failed: {e}")
                db_client.update_task_status(task_id, status="error", error=f"Metadata failed: {str(e)}")
                return
        else:
            # OPTION B: Fallback (Supadata missing or failed).
            # A. Download
            logger.info(f"Downloading {video_url} (Supadata skipped/failed)...")
            try:
                audio_path, video_title, thumbnail_url, direct_audio_url = await video_processor.download_and_convert(video_url, TEMP_DIR)
                # Update Title and Thumbnail in DB
                db_client.update_task_status(task_id, progress=30, video_title=video_title, thumbnail_url=thumbnail_url)
            except Exception as e:
                db_client.update_task_status(task_id, status="error", error=f"Download failed: {str(e)}")
                return

        # A2. Save direct audio URL (best effort; no storage upload)
        try:
            outputs = db_client.get_task_outputs(task_id)
            audio_output = next((o for o in outputs if o['kind'] == 'audio'), None)
            if audio_output:
                if direct_audio_url:
                    # Store as JSON to support richer UI (coverUrl), while frontend remains backward-compatible.
                    payload = {
                        "audioUrl": direct_audio_url,
                        "coverUrl": thumbnail_url,
                    }
                    db_client.update_output_status(audio_output['id'], status="completed", progress=100, content=json.dumps(payload, ensure_ascii=False))
                else:
                    db_client.update_output_status(audio_output['id'], status="error", error="No direct audio URL available")
        except Exception as e:
            logger.warning(f"Failed to update audio output: {e}")

        # B. Transcribe
        db_client.update_task_status(task_id, progress=40)
        # Find Script Output ID
        outputs = db_client.get_task_outputs(task_id)
        script_output = next((o for o in outputs if o['kind'] == 'script'), None)
        script_raw_output = next((o for o in outputs if o['kind'] == 'script_raw'), None)
        
        
        script_text = ""
        script_text_with_timestamps = ""
        if script_output:
            try:
                if supadata_result:
                    # Use Supadata result
                    logger.info("Using Supadata transcript for output.")
                    script_text_with_timestamps, raw_json, detected_language = supadata_result
                    db_client.update_output_status(script_output['id'], status="processing", progress=10)
                    
                    if script_raw_output:
                        db_client.update_output_status(script_raw_output['id'], status="completed", progress=100, content=raw_json)
                else:
                    # Use OpenAI Whisper
                    if not audio_path:
                        raise Exception("Audio path missing for local transcription")
                        
                    db_client.update_output_status(script_output['id'], status="processing", progress=10)
                    script_text_with_timestamps, raw_json, detected_language = await transcriber.transcribe_with_raw(audio_path)
                    
                    if script_raw_output:
                        db_client.update_output_status(script_raw_output['id'], status="completed", progress=100, content=raw_json)
                    
                    # Always (re)generate... logic is same
                    try:
                        payload = json.loads(raw_json or "{}")
                        raw_segments = payload.get("segments", [])
                        detected_language = payload.get("language", detected_language or "unknown")
                        script_text_with_timestamps = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)
                    except Exception as e:
                        logger.warning(f"Failed to regenerate formatted script: {e}")

            except Exception as e:
                err = f"Transcription failed: {str(e)}"
                db_client.update_output_status(script_output['id'], status="error", error=err)
                # If script fails, others probably fail too.
                db_client.update_task_status(task_id, status="error", error=err)
                return

        # C. Optimization (Optional step, usually part of Summary or specific output)
        if script_text_with_timestamps:
            # This produces a timestamp-free, meta-free clean transcript for UI display.
            optimized_script = await summarizer.optimize_transcript(script_text_with_timestamps)
            script_text = optimized_script  # Use optimized for downstream + store in DB

        if script_output and script_text:
            db_client.update_output_status(script_output['id'], status="completed", progress=100, content=script_text)

        # D. Summarize
        summary_output = next((o for o in outputs if o['kind'] == 'summary'), None)
        summary_source_output = next((o for o in outputs if o['kind'] == 'summary_source'), None)
        if (summary_output or summary_source_output) and script_text:
            try:
                # Determine transcript language from script_raw payload.
                transcript_language = "unknown"
                try:
                    payload = json.loads(raw_json or "{}")
                    transcript_language = (payload.get("language") or "unknown")
                except Exception:
                    transcript_language = "unknown"

                # 1) Generate stable source-language summary (with anchors).
                source_summary_json = None
                if summary_source_output:
                    db_client.update_output_status(summary_source_output['id'], status="processing", progress=20)
                    source_summary_json = await summarizer.summarize_in_language_with_anchors(
                        script_text,
                        summary_language=transcript_language,
                        video_title=video_title,
                        script_raw_json=raw_json,
                    )
                    db_client.update_output_status(
                        summary_source_output['id'],
                        status="completed",
                        progress=100,
                        content=source_summary_json,
                    )

                # 2) Produce user-requested summary output.
                if summary_output:
                    db_client.update_output_status(summary_output['id'], status="processing", progress=35)
                    if not source_summary_json:
                        source_summary_json = await summarizer.summarize_in_language_with_anchors(
                            script_text,
                            summary_language=transcript_language,
                            video_title=video_title,
                            script_raw_json=raw_json,
                        )

                    # If requested language differs from transcript language, translate while preserving anchors.
                    if (summary_lang or "unknown") and (str(summary_lang).lower() != str(transcript_language).lower()):
                        summary_json = await summarizer.translate_summary_json(
                            source_summary_json,
                            target_language=summary_lang,
                        )
                    else:
                        summary_json = source_summary_json

                    db_client.update_output_status(summary_output['id'], status="completed", progress=100, content=summary_json)
            except Exception as e:
                if summary_output:
                    db_client.update_output_status(summary_output['id'], status="error", error=str(e))
                if summary_source_output:
                    db_client.update_output_status(summary_source_output['id'], status="error", error=str(e))



        # Cleanup
        try:
            if audio_path and audio_path.exists():
                os.remove(audio_path)
        except:
            pass

        # Final Task Status
        # If any output is error? Or just complete?
        # Logic: If Script is done, Task is mostly done.
        db_client.update_task_status(task_id, status="completed", progress=100)

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
            db_client.update_output_status(output_id, status="error", error="Not authorized")
            return

        task_id = out.get("task_id")
        kind = out.get("kind")
        locale = out.get("locale")
        if not task_id or not kind:
            db_client.update_output_status(output_id, status="error", error="Invalid output")
            return

        outputs = db_client.get_task_outputs(task_id)
        script_output = next((o for o in outputs if o.get("kind") == "script"), None)
        script_raw_output = next((o for o in outputs if o.get("kind") == "script_raw"), None)

        if kind == "script":
            # Prefer re-formatting from persisted raw segments.
            if not script_raw_output or not script_raw_output.get("content"):
                db_client.update_output_status(output_id, status="error", error="No raw transcript segments found; please create a new task to re-transcribe.")
                return
            try:
                payload = json.loads(script_raw_output["content"])
                raw_segments = payload.get("segments", [])
                detected_language = payload.get("language", "unknown")
                md_with_ts = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)
                clean = await summarizer.optimize_transcript(md_with_ts)
                db_client.update_output_status(output_id, status="completed", progress=100, content=clean, error="")
                return
            except Exception as e:
                db_client.update_output_status(output_id, status="error", error=f"Reformat failed: {str(e)}")
                return

        # For summary/translation, rely on existing script content.
        if not script_output or not script_output.get("content"):
            db_client.update_output_status(output_id, status="error", error="Missing script content; cannot retry.")
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
                db_client.update_output_status(output_id, status="processing", progress=30, error="")
                # Always regenerate source-language summary first (stable, anchored).
                script_raw_json = None
                transcript_language = "unknown"
                try:
                    if script_raw_output and script_raw_output.get("content"):
                        script_raw_json = script_raw_output.get("content")
                        payload = json.loads(script_raw_json or "{}")
                        transcript_language = (payload.get("language") or "unknown")
                except Exception:
                    script_raw_json = script_raw_json

                source_summary_json = await summarizer.summarize_in_language_with_anchors(
                    script_text,
                    summary_language=transcript_language,
                    video_title=video_title,
                    script_raw_json=script_raw_json,
                )

                # Ensure summary_source output exists (old tasks may not have it).
                summary_source_out = next((o for o in outputs if o.get("kind") == "summary_source"), None)
                if not summary_source_out:
                    try:
                        summary_source_out = db_client.create_task_output(task_id, user_id, kind="summary_source")
                        # Refresh outputs list for downstream lookups
                        outputs = db_client.get_task_outputs(task_id)
                    except Exception as e:
                        logger.warning(f"Failed to create summary_source output for task={task_id}: {e}")

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
                    db_client.update_output_status(output_id, status="completed", progress=100, content=source_summary_json, error="")
                    return

                # kind == "summary": translate to requested locale if needed, preserving anchors.
                requested_lang = locale or transcript_language or "zh"
                if str(requested_lang).lower() != str(transcript_language).lower():
                    summary_json = await summarizer.translate_summary_json(source_summary_json, target_language=requested_lang)
                else:
                    summary_json = source_summary_json

                db_client.update_output_status(output_id, status="completed", progress=100, content=summary_json, error="")
            except Exception as e:
                db_client.update_output_status(output_id, status="error", error=str(e))
            return



        db_client.update_output_status(output_id, status="error", error=f"Retry not supported for kind: {kind}")

    except Exception as e:
        db_client.update_output_status(output_id, status="error", error=str(e))

@app.patch("/api/tasks/{task_id}")
async def update_task_title(
    task_id: str,
    payload: dict = Body(...),
    user_id: str = Depends(get_current_user)
):
    """
    Update task details (title).
    Secure endpoint: checks ownership.
    """
    # 1. Verify Ownership
    task = db_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Update
    new_title = payload.get("video_title")
    if new_title:
        db_client.update_task_status(task_id, video_title=new_title)
        
    return {"status": "success"}



@app.post("/api/create-checkout-session")
async def create_checkout_session(
    price_id: str = Form(...),
    user_id: str = Depends(get_current_user)
):
    """Create Stripe Checkout Session."""
    price = settings.get_price_by_id(price_id)
    if not price:
        raise HTTPException(status_code=400, detail="Invalid Price ID")
        
    mode = price.mode
        
    try:
        checkout_session = stripe.checkout.Session.create(
            client_reference_id=user_id,
            line_items=[
                {
                    'price': price_id,
                    'quantity': 1,
                },
            ],
            mode=mode,
            success_url=settings.FRONTEND_URL + "/settings/pricing?success=true",
            cancel_url=settings.FRONTEND_URL + "/settings/pricing?canceled=true",
        )
        
        # Unified Order Creation (Pending)
        # We treat Stripe session creation as the start of an order.
        # But we don't know the amount for sure if it's dynamic, but here it's fixed Price ID.
        # We'll rely on webhook to confirm, but good to track "attempt".
        try:
             # Just logs, non-blocking
             db_client.create_payment_order(user_id, "stripe", 0.0, "USD") 
             # Note: We need to update this with session_id, but session object above has it.
             # Actually, better to insert AFTER session create so we have session.id
             # But create_payment_order returns order object.
             # Let's do it cleanly:
        except:
             pass

        # Update the order with session ID? 
        # To do it right:
        # 1. Create Order
        # order = db_client.create_payment_order(...)
        # 2. Create Session (pass order_id in metadata?)
        # 3. Update Order with session.id
        
        # Implementation:
        amount_est = price.amount
        
        order = db_client.create_payment_order(user_id, "stripe", amount_est, "USD")
        if order:
             db_client.update_payment_order(order['id'], provider_payment_id=checkout_session.id)
        
        return {"url": checkout_session.url}
    except Exception as e:
        logger.error(f"Stripe session creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "16080")))
