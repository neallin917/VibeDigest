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
from translator import Translator
from db_client import DBClient
from notifier import Notifier
from pydantic import BaseModel

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="VibeDigest API (v2)", version="2.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
translator = Translator()
db_client = DBClient()
db_client = DBClient()
notifier = Notifier()

# Stripe Config
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
PRO_PRICE_ID = "price_1ShU6GP16NRNsVf5dcAqHHDV"
PRO_ANNUAL_PRICE_ID = "price_1ShVNXP16NRNsVf56kArMPa4"
CREDIT_PACK_PRICE_ID = "price_1ShU6pP16NRNsVf5EdlEFgOE"

# Coinbase Config
coinbase_client = CoinbaseClient(api_key=os.getenv("COINBASE_API_KEY"))
COINBASE_WEBHOOK_SECRET = os.getenv("COINBASE_WEBHOOK_SECRET")

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
    """Return public configuration."""
    return {
        "supabase_url": os.getenv("SUPABASE_URL"),
        "supabase_key": os.getenv("SUPABASE_KEY")
    }

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
    translate_targets: str = Form(default=""), # JSON string list of locales, optional
    user_id: str = Depends(get_current_user)
):
    """
    Start a new video processing task.
    Creates 1 Task + N Outputs (Script, Summary, [Translations...]).
    """
    # Normalize URL if scheme is missing
    if not video_url.startswith(("http://", "https://")):
        video_url = f"https://{video_url}"

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
        summary_out = db_client.create_task_output(task_id, user_id, kind="summary", locale=summary_language)
        if audio_out:
            outputs.append(audio_out)
        outputs.extend([script_out, script_raw_out, summary_out])

        # 3. Create Translation Outputs if requested
        # Format: translate_targets='["en", "ja"]' or empty
        if translate_targets:
            try:
                targets = json.loads(translate_targets)
                if isinstance(targets, list):
                    for target in targets:
                        # Don't create if same as summary language or source? (Optional logic)
                        tr_out = db_client.create_task_output(task_id, user_id, kind="translation", locale=target)
                        outputs.append(tr_out)
            except:
                logger.warning("Failed to parse translate_targets JSON")

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
            payload, sig_header, os.environ.get("STRIPE_WEBHOOK_SECRET")
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
    
    # 1. Determine Amount
    amount = 20.00 # Default for Credits
    name = "20 Credits Top-up"
    if price_id == PRO_PRICE_ID:
        # Warning: Monthly logic on crypto is tricky. 
        # For now, we allow it as a one-time "1 Month Access" or similar?
        # User requirement says "Top up credits" is main focus.
        # But if they select Pro, we might charge $29 (example) for 1 month manual.
        # Let's assume Credit Pack for simplified MVP unless specified.
        # Check ID
        pass
    
    # Validation/Mapping
    if price_id == CREDIT_PACK_PRICE_ID:
        amount = 5.00 # 20 Credits
        name = "20 Credits Top-up (One-time)"
    elif price_id == PRO_PRICE_ID:
        amount = 9.90 # Pro Month
        name = "Pro Plan (1 Month)"
    elif price_id == PRO_ANNUAL_PRICE_ID:
        amount = 99.00 # Pro Annual
        name = "Pro Plan (1 Year)"
    else:
         raise HTTPException(status_code=400, detail="Invalid Price ID")

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
            "redirect_url": os.getenv("FRONTEND_URL", "http://localhost:3000") + "/settings/pricing?success=true",
            "cancel_url": os.getenv("FRONTEND_URL", "http://localhost:3000") + "/settings/pricing?canceled=true",
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
        event = CoinbaseWebhook.construct_event(payload.decode('utf-8'), sig_header, COINBASE_WEBHOOK_SECRET)
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
                db_client.update_payment_order(
                    order_id, 
                    status='completed', 
                    amount_crypto=float(crypto_amt),
                    currency_crypto=crypto_curr,
                    metadata=charge
                )
        
        # Fulfill
        if user_id:
            if price_id == CREDIT_PACK_PRICE_ID:
                db_client.add_credits(user_id, 20)
            elif price_id == PRO_PRICE_ID:
                # 1 Month access?
                # current_period_end = now + 30 days
                # For MVP, maybe we skip Pro on Crypto or implement manual date math
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

        # A. Download
        logger.info(f"Downloading {video_url}...")
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
        if script_output:
            try:
                db_client.update_output_status(script_output['id'], status="processing", progress=10)
                script_text, raw_json, detected_language = await transcriber.transcribe_with_raw(audio_path)
                # Persist raw segments first (single source of truth)
                if script_raw_output:
                    db_client.update_output_status(script_raw_output['id'], status="completed", progress=100, content=raw_json)

                # Always (re)generate markdown from raw segments to ensure latest formatting rules
                # are applied consistently without any frontend "retry" UX.
                try:
                    payload = json.loads(raw_json or "{}")
                    raw_segments = payload.get("segments", [])
                    detected_language = payload.get("language", detected_language or "unknown")
                    script_text = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)
                except Exception as e:
                    logger.warning(f"Failed to regenerate formatted script from raw segments: {e}")
                db_client.update_output_status(script_output['id'], status="completed", progress=100, content=script_text)
            except Exception as e:
                err = f"Transcription failed: {str(e)}"
                db_client.update_output_status(script_output['id'], status="error", error=err)
                # If script fails, others probably fail too.
                db_client.update_task_status(task_id, status="error", error=err)
                return

        # C. Optimization (Optional step, usually part of Summary or specific output)
        if script_text:
             optimized_script = await summarizer.optimize_transcript(script_text)
             script_text = optimized_script # Use optimized for downstream

        # D. Summarize
        summary_output = next((o for o in outputs if o['kind'] == 'summary'), None)
        if summary_output and script_text:
            try:
                db_client.update_output_status(summary_output['id'], status="processing", progress=20)
                summary_text = await summarizer.summarize(script_text, summary_lang, video_title)
                db_client.update_output_status(summary_output['id'], status="completed", progress=100, content=summary_text)
            except Exception as e:
                db_client.update_output_status(summary_output['id'], status="error", error=str(e))

        # E. Translate
        translation_outputs = [o for o in outputs if o['kind'] == 'translation']
        for t_out in translation_outputs:
            if script_text:
                try:
                    db_client.update_output_status(t_out['id'], status="processing", progress=20)
                    # Detect language first? Existing translator logic...
                    # For V2, let's assume direct translation from Script.
                    target_lang = t_out.get('locale', 'en')
                    # We might need source lang. Transcriber usually returns it. 
                    # For now passing "auto" or letting translator handle it.
                    translated = await translator.translate_text(script_text, target_lang, None)
                    db_client.update_output_status(t_out['id'], status="completed", progress=100, content=translated)
                except Exception as e:
                    db_client.update_output_status(t_out['id'], status="error", error=str(e))

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
                md = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)
                db_client.update_output_status(output_id, status="completed", progress=100, content=md, error="")
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

        if kind == "summary":
            task = db_client.get_task(task_id)
            video_title = (task or {}).get("video_title") or ""
            try:
                db_client.update_output_status(output_id, status="processing", progress=30, error="")
                summary_text = await summarizer.summarize(script_text, locale or "zh", video_title)
                db_client.update_output_status(output_id, status="completed", progress=100, content=summary_text, error="")
            except Exception as e:
                db_client.update_output_status(output_id, status="error", error=str(e))
            return

        if kind == "translation":
            try:
                db_client.update_output_status(output_id, status="processing", progress=30, error="")
                translated = await translator.translate_text(script_text, locale or "en", None)
                db_client.update_output_status(output_id, status="completed", progress=100, content=translated, error="")
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
    domain_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Determine mode
    mode = 'subscription'
    if price_id == CREDIT_PACK_PRICE_ID:
        mode = 'payment'
        
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
            success_url=domain_url + "/settings/pricing?success=true",
            cancel_url=domain_url + "/settings/pricing?canceled=true",
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
        amount_est = 0.0
        if price_id == CREDIT_PACK_PRICE_ID: amount_est = 5.00
        if price_id == PRO_PRICE_ID: amount_est = 19.00
        
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
