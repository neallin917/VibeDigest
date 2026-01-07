import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from workflow import transcribe, summarize, VideoProcessingState
from db_client import DBClient

@pytest.mark.asyncio
async def test_transcribe_failure_handling():
    """
    Test that transcribe node handles exceptions by updating task status to 'error'.
    """
    # Setup State
    state: VideoProcessingState = {
        "task_id": "test-task-failure",
        "user_id": "test-user",
        "video_url": "http://test.com/video",
        "audio_path": "/tmp/test.mp3",
        "errors": [],
        "cache_hit": False,
        "is_youtube": False,
        "transcript_text": None
    }
    
    # Mock DBClient
    with patch('workflow.db_client') as mock_db:
        # Mock Transcriber to raise exception
        with patch('workflow.transcriber') as mock_transcriber:
            mock_transcriber.transcribe_with_raw = AsyncMock(side_effect=Exception("Whisper Failed"))
            
            mock_db.get_task_outputs.return_value = [
                {"id": "script-out-id", "kind": "script", "status": "pending"}
            ]
            
            # Execute Node
            updates = await transcribe(state)
            
            # Verify Error Handling
            assert "errors" in updates
            assert "Whisper Failed" in updates["errors"][0]
            
            # Verify DB Updates
            mock_db.update_task_status.assert_called_with(
                "test-task-failure", 
                status="error", 
                error="Transcribe failed: Whisper Failed"
            )

@pytest.mark.asyncio
async def test_summarize_failure_handling():
    """
    Test that summarize node handles exceptions by updating output status to 'error'.
    """
    state: VideoProcessingState = {
        "task_id": "test-task-sum-fail",
        "user_id": "test-user",
        "video_url": "http://test.com/video",
        "transcript_text": "Some text",
        "video_title": "Test Video",
        "errors": [],
        "summary_lang": "en"
    }
    
    with patch('workflow.db_client') as mock_db:
        with patch('workflow.summarizer') as mock_summarizer:
            mock_summarizer.summarize_in_language_with_anchors = AsyncMock(side_effect=Exception("LLM Rate Limit"))
            
            # Mock outputs existence
            mock_db.get_task_outputs.return_value = [
                {"id": "sum-out-id", "kind": "summary", "status": "pending"},
                {"id": "src-out-id", "kind": "summary_source", "status": "pending"}
            ]
            
            updates = await summarize(state)
            
            assert "errors" in updates
            assert "LLM Rate Limit" in updates["errors"][0]
            
            # Verify Output Status Updates
            # Should look for calls to update_output_status with status='error'
            error_calls = [
                call for call in mock_db.update_output_status.call_args_list 
                if call.kwargs.get('status') == 'error'
            ]
            assert len(error_calls) >= 1
            assert "LLM Rate Limit" in error_calls[0].kwargs['error']
