import asyncio
import sys
import logging
from pathlib import Path
from unittest.mock import AsyncMock, patch

# Setup path and env
sys.path.append(str(Path(__file__).parent.parent))

from utils.env_loader import load_env
load_env()

# Configure simplified logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

# We need to import after sys.path is set, but we also want to patch BEFORE main logic runs if possible.
# Ideally we patch the module 'workflow' where these instances are.
from workflow import app, VideoProcessingState  # noqa: E402

async def test_workflow_mocked():
    print("--- Starting Mocked Workflow Test ---")
    
    # 1. Setup Mocks
    # We explicitly patch the instances used in workflow.py
    # Note: workflow.py initializes them at module level: db_client, video_processor, etc.
    
    with patch('workflow.db_client') as mock_db, \
         patch('workflow.video_processor') as mock_vp, \
         patch('workflow.transcriber') as mock_transcriber, \
         patch('workflow.summarizer') as mock_summarizer, \
         patch('workflow.supadata_client') as mock_supadata:

        # --- Mock Supadata ---
        mock_supadata.get_transcript_async = AsyncMock(return_value=(None, None, None)) # Force fallback to download

        # --- Mock DB Behaviors ---
        mock_db.find_latest_completed_task_by_url.return_value = None  # Cache Miss
        
        # Mock get_task_outputs to return placeholders needed by nodes
        # Each node looks for specific kinds.
        mock_outputs = [
            {"id": "out-script", "kind": "script", "status": "pending", "locale": "en"},
            {"id": "out-raw", "kind": "script_raw", "status": "pending", "locale": "en"},
            {"id": "out-class", "kind": "classification", "status": "pending", "locale": "en"},
            {"id": "out-sum-src", "kind": "summary_source", "status": "pending", "locale": "en"},
            {"id": "out-sum", "kind": "summary", "status": "pending", "locale": "en"},
            {"id": "out-audio", "kind": "audio", "status": "pending", "locale": "en"},
        ]
        mock_db.get_task_outputs.return_value = mock_outputs
        
        # --- Mock Video Processor ---
        # Mock download_and_convert return: (audio_path, title, thumb, direct_url, meta)
        mock_vp.download_and_convert = AsyncMock(return_value=(
            "mock_audio.mp3", 
            "Mock Video Title", 
            "http://thumb.url", 
            None, 
            {"duration": 120, "author": "Mock Author"}
        ))
        
        # --- Mock Transcriber ---
        # Return: (script_md, raw_json, lang)
        mock_transcriber.transcribe_with_raw = AsyncMock(return_value=(
            "Mock transcript text with timestamps.", 
            '{"segments": []}', 
            "en"
        ))
        
        # --- Mock Summarizer ---
        # Mock class methods
        # IMPORTANT: Must be >50 chars to pass 'Smart Skip' in cognition node
        long_transcript = "Optimized mock transcript. " * 3
        mock_summarizer.optimize_transcript = AsyncMock(return_value=long_transcript)
        mock_summarizer.classify_content = AsyncMock(return_value={"form": "monologue", "confidence": 0.9})
        # Workflow calls .summarize() which internally might call others, but we should mock the entry point used by workflow.py
        mock_summarizer.summarize = AsyncMock(return_value={"overview": "Mock summary", "keypoints": []})
        mock_summarizer.summarize_in_language_with_anchors = AsyncMock(return_value='{"overview": "Mock summary"}')
        mock_summarizer.translate_summary_json = AsyncMock(return_value='{"overview": "Mock summary translated"}')

        # --- Initial State ---
        initial_state = VideoProcessingState(
            task_id="test-task-123",
            user_id="test-user-456",
            video_url="https://youtube.com/watch?v=mock",
            summary_lang="en",
            video_title="",
            thumbnail_url="",
            author="",
            duration=0.0,
            audio_path=None,
            direct_audio_url=None,
            transcript_text=None,
            transcript_raw=None,
            transcript_lang="",
            classification_result=None,
            source_summary_json=None,
            final_summary_json=None,
            cache_hit=False,
            is_youtube=True,
            errors=[]
        )

        print(f"Running workflow for: {initial_state['video_url']}")
        
        # 2. Run Workflow
        final_state = await app.ainvoke(initial_state)
        
        # 3. Validation
        print("\n--- Workflow Finished ---")
        print(f"Final Transcript: {final_state.get('transcript_text')}")
        print(f"Final Summary: {final_state.get('final_summary_json')}")
        print(f"Errors: {final_state.get('errors')}")

        # Assertions
        assert final_state.get("transcript_text") == long_transcript
        assert final_state.get("final_summary_json") is not None
        print("\n✅ Verification SUCCESS: Graph executed all nodes correctly.")

if __name__ == "__main__":
    asyncio.run(test_workflow_mocked())
