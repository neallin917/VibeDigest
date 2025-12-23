from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Header, BackgroundTasks, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, List
import uuid
import json
import shutil
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from video_processor import VideoProcessor
from transcriber import Transcriber
from summarizer import Summarizer
from translator import Translator
from translator import Translator
from db_client import DBClient
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
db_client = DBClient()

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
    try:
        # 1. Create Task
        task = db_client.create_task(user_id=user_id, video_url=video_url)
        task_id = task['id']
        logger.info(f"Created task {task_id} for user {user_id}")

        # 2. Create Outputs (Script & Summary are default)
        outputs = []
        script_out = db_client.create_task_output(task_id, user_id, kind="script")
        summary_out = db_client.create_task_output(task_id, user_id, kind="summary", locale=summary_language)
        outputs.extend([script_out, summary_out])

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
    feedback: FeedbackModel,
    user_id: str = Depends(get_current_user)
):
    """
    Submit user feedback/complaint.
    Currently logs to stdout/file.
    """
    logger.info(f"FEEDBACK [{feedback.category}] from {user_id}: {feedback.message} (Contact: {feedback.contact_email})")
    
    # In a real app, save to DB or send email
    # db_client.save_feedback(...)
    
    return {"status": "received", "message": "Thank you for your feedback!"}

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
            audio_path, video_title, thumbnail_url = await video_processor.download_and_convert(video_url, TEMP_DIR)
            # Update Title and Thumbnail in DB
            db_client.update_task_status(task_id, progress=30, video_title=video_title, thumbnail_url=thumbnail_url)
        except Exception as e:
            db_client.update_task_status(task_id, status="error", error=f"Download failed: {str(e)}")
            return

        # B. Transcribe
        db_client.update_task_status(task_id, progress=40)
        # Find Script Output ID
        outputs = db_client.get_task_outputs(task_id)
        script_output = next((o for o in outputs if o['kind'] == 'script'), None)
        
        script_text = ""
        if script_output:
            try:
                db_client.update_output_status(script_output['id'], status="processing", progress=10)
                script_text = await transcriber.transcribe(audio_path)
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
    # 1. Get Output details (We assume we can fetch via DBClient with ID)
    # Since DBClient.get_task_outputs gets list, we might implement get_output_by_id or direct SQL
    # For now, simplistic approach:
    # We need READ access. Service Role has it.
    pass # Implementation requires fetching row. 
    # Logic:
    # if kind == 'script': re-run Download+Transcribe? (Expensive/Hard without URL).
    # if kind == 'summary': fetch task's script content -> re-run summarize.
    # if kind == 'translation': fetch task's script content -> re-run translate.

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

@app.delete("/api/tasks/{task_id}")
async def delete_task_endpoint(
    task_id: str,
    user_id: str = Depends(get_current_user)
):
    """
    Delete a task.
    Secure endpoint: checks ownership.
    """
    # 1. Verify Ownership
    task = db_client.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task['user_id'] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Delete
    success = db_client.delete_task(task_id)
    if not success:
        raise HTTPException(status_code=500, detail="Delete failed")
        
    return {"status": "success"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "16080")))
