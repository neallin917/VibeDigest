import logging
from typing import Optional, List
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from db_client import DBClient

# We need to import get_current_user from main, but to avoid circular imports, 
# it's better if dependencies are in a shared module. 
# For now, let's assume we can import check_user or similar if we refactor, 
# or we just rely on the router being included in main where dependency is injected.
# BUT, to declare the router here, we need the dependency function signature.
# Let's create a stub or import it if we can. 
# Checking main.py: get_current_user is defined there.
# It uses db_client.validate_token.
# Let's define a local dependency that does the same thing or move get_current_user to dependencies.py.
# Moving to dependencies.py is cleaner.

from dependencies import get_current_user

router = APIRouter(prefix="/api/threads", tags=["threads"])
logger = logging.getLogger(__name__)
db_client = DBClient()

# --- Models ---
class ThreadCreate(BaseModel):
    task_id: str

class ThreadUpdate(BaseModel):
    title: str

class ThreadResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    task_id: uuid.UUID
    title: str
    status: str
    created_at: datetime
    updated_at: datetime
    metadata: dict = {}

class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

# --- Endpoints ---

@router.post("", response_model=ThreadResponse, status_code=201)
def create_thread(
    payload: ThreadCreate,
    user_id: str = Depends(get_current_user)
):
    """Create a new chat thread (Multi-session support)."""
    # Verify Task Ownership
    task = db_client.get_task(payload.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # We allow accessing demo tasks, but creating threads for them? 
    # If the user is authenticated, they can create a thread FOR a demo task?
    # Usually threads are private. Demo task is public.
    # If user views a demo task, they should probably clone it or we create a thread linked to it?
    # For now, simplistic check: user must own the task OR task is demo.
    # If task is demo, any user can create a thread for it (thread is private to user).
    is_demo = task.get("is_demo", False)
    if str(task["user_id"]) != str(user_id) and not is_demo:
         raise HTTPException(status_code=403, detail="Not authorized to access this task")

    try:
        data = db_client.create_chat_thread(user_id=user_id, task_id=payload.task_id, title="New Chat")
        return data
    except Exception as e:
        logger.error(f"Create thread failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[ThreadResponse])
def list_threads(
    task_id: str = Query(...),
    status: str = Query("!=deleted", description="Filter by status. Default is not deleted."),
    limit: int = 20,
    user_id: str = Depends(get_current_user)
):
    """List threads for a task. Default filters out deleted ones."""
    try:
        threads = db_client.list_chat_threads(user_id=user_id, task_id=task_id, status_filter=status, limit=limit)
        return threads
    except Exception as e:
        logger.error(f"List threads failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{thread_id}", response_model=ThreadResponse)
def update_thread(
    payload: ThreadUpdate,
    thread_id: str = Path(...),
    user_id: str = Depends(get_current_user)
):
    """Update thread title."""
    try:
        thread = db_client.get_chat_thread(thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")
        if str(thread["user_id"]) != str(user_id):
             raise HTTPException(status_code=403, detail="Not authorized")
             
        updated = db_client.update_chat_thread(thread_id, title=payload.title)
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update thread failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{thread_id}", status_code=204)
def delete_thread(
    thread_id: str = Path(...),
    user_id: str = Depends(get_current_user)
):
    """Soft delete a thread."""
    try:
        thread = db_client.get_chat_thread(thread_id)
        if not thread:
            # 404 or success? Idempotent -> Success usually, but let's say 404 to be specific if needed.
            # Standard: if not found, 404.
             raise HTTPException(status_code=404, detail="Thread not found")
        
        if str(thread["user_id"]) != str(user_id):
             raise HTTPException(status_code=403, detail="Not authorized")
             
        db_client.soft_delete_chat_thread(thread_id)
        return None
    except HTTPException:
        raise
    except Exception as e:
         logger.error(f"Delete thread failed: {e}")
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/{thread_id}/messages", response_model=List[MessageResponse])
def get_thread_messages(
    thread_id: str = Path(...),
    limit: int = 50,
    user_id: str = Depends(get_current_user)
):
    """Get history for a thread."""
    try:
        thread = db_client.get_chat_thread(thread_id)
        if not thread:
             raise HTTPException(status_code=404, detail="Thread not found")
        if str(thread["user_id"]) != str(user_id):
             raise HTTPException(status_code=403, detail="Not authorized")
             
        # Mocking history for now as LangGraph integration is in Milestone 2
        # But we should try to fetch from where? LangGraph persistence?
        # Yes, Checkpointer writes to DB.
        # DBClient needs a method to query LangGraph tables roughly, or valid LangGraph SDK usage.
        # CheckpointStore is complex to query directly for "messages list".
        # Phase 2 will clarify this. For Phase 1 API check, we return empty list or mock.
        return [] 
    except HTTPException:
        raise
    except Exception as e:
         logger.error(f"Get messages failed: {e}")
         raise HTTPException(status_code=500, detail=str(e))

# --- Streaming Endpoint ---
from langchain_core.messages import HumanMessage
from fastapi.responses import StreamingResponse
from agent.chat_graph import graph

class ChatRequest(BaseModel):
    messages: List[dict] # [{"role": "user", "content": "..."}]

@router.post("/{thread_id}/stream")
async def stream_chat(
    payload: ChatRequest,
    thread_id: str = Path(...),
    user_id: str = Depends(get_current_user)
):
    """
    Stream chat response (SSE). 
    Updates thread updated_at on first token.
    """
    # 1. Verify Ownership
    thread = db_client.get_chat_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if str(thread["user_id"]) != str(user_id):
         raise HTTPException(status_code=403, detail="Not authorized")

    # 2. Prepare Input
    # Convert payload messages to LangChain format if needed, 
    # but the graph (ReAct) expects 'messages' in state.
    # We usually pass only the NEW user message, or the full history?
    # LangGraph persists history. So we only pass the NEW message(s).
    # Usage: Front-end sends the *latest* message(s) to append.
    
    last_msg = payload.messages[-1]
    if last_msg.get("role") != "user":
         raise HTTPException(status_code=400, detail="Last message must be from user")
         
    user_msg = HumanMessage(content=last_msg.get("content", ""))
    
    config = {"configurable": {"thread_id": thread_id}}

    async def event_stream():
        has_updated_ts = False
        try:
            # Stream events from the graph
            async for event in graph.astream_events(
                {"messages": [user_msg]}, 
                config=config, 
                version="v1"
            ):
                kind = event["event"]
                
                # Update timestamp on first token (or start of run)
                if not has_updated_ts:
                    db_client.update_chat_thread(thread_id, metadata={"last_activity": "streaming"})
                    has_updated_ts = True

                # Filter for LLM streaming tokens
                if kind == "on_chat_model_stream":
                    content = event["data"]["chunk"].content
                    if content:
                        # SSE format: data: ...
                        yield f"data: {content}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"event: error\ndata: {str(e)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
