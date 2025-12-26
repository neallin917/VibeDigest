import pytest
from unittest.mock import MagicMock, patch
from httpx import AsyncClient
from main import app, get_current_user

# --- Authentication Mock ---
# Bypass Supabase token validation
async def mock_get_current_user():
    return "test_mock_user_id"

# Apply the override globally for this test module
# (In a real suite, might do this in a fixture or per test)
app.dependency_overrides[get_current_user] = mock_get_current_user

@pytest.mark.asyncio
async def test_process_video_endpoint_success(async_client: AsyncClient):
    """
    Test the happy path for creating a video task.
    MOCKS: DBClient, run_pipeline.
    """
    with patch("main.db_client") as mock_db, \
         patch("main.run_pipeline") as mock_pipeline:
        
        # 1. Setup Mock Behaviors
        # Simulate Quota Check -> OK
        mock_db.check_and_consume_quota.return_value = True
        
        # Simulate Task Creation -> Returns dict with ID
        mock_db.create_task.return_value = {
            "id": "mock_task_123", 
            "user_id": "test_mock_user_id",
            "video_url": "https://example.com/video"
        }
        
        # Simulate Output Creation -> Returns dict
        mock_db.create_task_output.return_value = {
            "id": "mock_out_db_id", 
            "kind": "script",
            "user_id": "test_mock_user_id"
        }
        
        # 2. Define Request Payload
        payload = {
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "summary_language": "zh"
        }
        
        # 3. Make Request
        response = await async_client.post("/api/process-video", data=payload)
        
        # 4. Assertions
        assert response.status_code == 200, f"Response: {response.text}"
        data = response.json()
        assert data["task_id"] == "mock_task_123"
        assert "Task created successfully" in data["message"]
        
        # 5. Verify Side Effects (Mocks)
        # Ensure Quota was checked
        mock_db.check_and_consume_quota.assert_called_once_with("test_mock_user_id")
        
        # Ensure Task was created in DB
        mock_db.create_task.assert_called()
        
        # Ensure Outputs were created (Script, Summary, etc.)
        assert mock_db.create_task_output.call_count >= 2 
        
        # Ensure Background Task was triggered
        # Note: FastAPI BackgroundTasks run *after* response in the ASGI app.
        # With AsyncClient/TestClient, they are typically executed.
        # Since we patched 'main.run_pipeline', we verify that mock was called.
        # We need to wait a tiny bit or just check? 
        # AsyncClient usually runs them unless explicitly disabled.
        # For now, we assert it WAS called because we want to ensure the endpoint *tried* to start it.
        mock_pipeline.assert_called_once()
        args, _ = mock_pipeline.call_args
        assert args[0] == "mock_task_123"  # task_id
        assert args[1] == "https://www.youtube.com/watch?v=dQw4w9WgXcQ" # video_url


@pytest.mark.asyncio
async def test_process_video_quota_exceeded(async_client: AsyncClient):
    """
    Test behavior when user has no credits.
    """
    with patch("main.db_client") as mock_db:
        # Simulate Quota Check -> ERROR
        mock_db.check_and_consume_quota.return_value = False
        
        payload = {
            "video_url": "https://example.com/nofunds",
            "summary_language": "en"
        }
        
        response = await async_client.post("/api/process-video", data=payload)
        
        assert response.status_code == 402
        assert "Quota exceeded" in response.json()["detail"]
