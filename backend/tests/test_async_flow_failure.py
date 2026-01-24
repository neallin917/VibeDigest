import pytest
from unittest.mock import AsyncMock, patch
from workflow import ingest, cognition, VideoProcessingState
from constants import TaskStatus

@pytest.mark.asyncio
async def test_ingest_failure_handling():
    """
    Test that ingest node handles exceptions by updating task status to 'error'.
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
        "transcript_text": None,
        "video_title": "",
        "thumbnail_url": "",
        "author": "",
        "duration": 0,
        "direct_audio_url": None,
        "transcript_raw": None,
        "transcript_lang": "en",
        "classification_result": None,
        "source_summary_json": None,
        "final_summary_json": None,
        "comprehension_brief_json": None,
        "summary_lang": "en",
        "transcript_source": None,
        "ingest_error": None
    }

    # Mock DBClient
    with patch('workflow.db_client') as mock_db:
        # Mock dependencies
        with patch('workflow.video_processor') as mock_vp, \
             patch('workflow.supadata_client') as mock_supa, \
             patch('workflow.transcriber') as mock_transcriber:

            # Mock Metadata extraction
            mock_vp.extract_info_only = AsyncMock(return_value={
                "title": "Test Video",
                "thumbnail": "http://thumb",
                "duration": 100
            })

            # Strategy 1 (Supadata) fails
            mock_supa.get_transcript_async = AsyncMock(side_effect=Exception("Supadata Failed"))

            # Strategy 2 (VTT) fails
            mock_vp.extract_captions = AsyncMock(side_effect=Exception("VTT Failed"))

            # Strategy 3 (Whisper) setup
            mock_vp.download_and_convert = AsyncMock(return_value=(
                "/tmp/test.mp3", "Test Video", "http://thumb", "http://audio", {"duration": 100}
            ))

            # Strategy 3 Transcribe fails
            mock_transcriber.transcribe_with_raw = AsyncMock(side_effect=Exception("Whisper Failed"))

            # Mock DB interactions
            mock_db.get_task_outputs.return_value = []

            # Execute Node
            updates = await ingest(state)

            # Verify Error Handling
            # The ingest node appends the error string to the errors list
            assert "errors" in updates or "ingest_error" in updates
            errors = updates.get("errors", [])
            # Also check ingest_error
            ingest_error = updates.get("ingest_error")

            has_whisper_error = "Whisper Failed" in str(ingest_error) if ingest_error else False
            if not has_whisper_error:
                has_whisper_error = any("Whisper Failed" in str(e) for e in errors)

            assert has_whisper_error, f"Expected 'Whisper Failed' in errors. Got: {errors}, ingest_error: {ingest_error}"

            # Verify DB Updates
            # Should have called update_task_status with status='error'
            error_calls = [
                c for c in mock_db.update_task_status.call_args_list
                if c.kwargs.get('status') == 'error' or c.kwargs.get('status') == TaskStatus.ERROR
            ]
            assert len(error_calls) >= 1
            assert "Whisper Failed" in error_calls[0].kwargs.get('error', '')

@pytest.mark.asyncio
async def test_cognition_failure_handling():
    """
    Test that cognition node handles exceptions by returning them in errors list.
    """
    state: VideoProcessingState = {
        "task_id": "test-task-sum-fail",
        "user_id": "test-user",
        "video_url": "http://test.com/video",
        "transcript_text": "Some text content that is long enough for analysis so it does not get skipped.",
        "video_title": "Test Video",
        "errors": [],
        "summary_lang": "en",
        "is_youtube": False,
        "cache_hit": False,
        "audio_path": None,
        "thumbnail_url": "",
        "author": "",
        "duration": 0,
        "direct_audio_url": None,
        "transcript_raw": None,
        "transcript_lang": "en",
        "classification_result": None,
        "source_summary_json": None,
        "final_summary_json": None,
        "comprehension_brief_json": None,
        "transcript_source": None,
        "ingest_error": None
    }

    with patch('workflow.db_client') as mock_db, \
         patch('workflow.summarizer') as mock_summarizer, \
         patch('workflow.settings') as mock_settings:

            # Force sequential execution to be deterministic
            mock_settings.COGNITION_SEQUENTIAL = True
            mock_settings.COGNITION_DELAY = 0

            # Mock Classify success
            mock_summarizer.classify_content = AsyncMock(return_value={"category": "Tech"})

            # Mock Summarize failure
            mock_summarizer.summarize = AsyncMock(side_effect=Exception("LLM Rate Limit"))

            # Mock DB interactions
            mock_db.get_task_outputs.return_value = []

            updates = await cognition(state)

            assert "errors" in updates
            assert any("LLM Rate Limit" in str(e) for e in updates["errors"])

            # Note: The current implementation of cognition/_run_summarize does NOT
            # update the output status to 'error' in the DB, it only reports the error in the state.
            # So we do not assert mock_db.update_output_status(status='error').
