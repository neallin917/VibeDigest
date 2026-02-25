import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import os
from main import app
from dependencies import get_current_user, get_db_client, get_video_processor
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_preview_video(api_client, mock_video_processor):
    response = await api_client.post("/api/preview-video", data={"url": "https://youtube.com/watch?v=123"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Video"
    mock_video_processor.extract_info_only.assert_called_once()

@pytest.mark.asyncio
async def test_preview_video_invalid_url(api_client, mock_video_processor):
    with patch("api.routes.tasks.normalize_video_url", return_value=None):
        response = await api_client.post("/api/preview-video", data={"url": "invalid"})
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_process_video_success(api_client, mock_db_client):
    """Successful task creation: task created and pipeline queued."""
    mock_db_client.create_task.return_value = {"id": "task_123"}

    with patch("api.routes.tasks.run_pipeline"), \
         patch("dependencies.increment_guest_usage"):
        response = await api_client.post("/api/process-video", data={"video_url": "https://youtube.com/watch?v=123"})
        assert response.status_code == 200
        assert response.json() == {"task_id": "task_123", "message": "Task started"}
        mock_db_client.create_task.assert_called_once()

@pytest.mark.asyncio
async def test_process_video_quota_exceeded(mock_db_client, mock_video_processor, mock_coinbase_client):
    """Guest quota exceeded: dependency raises 402 before the route body runs."""
    from fastapi import HTTPException as FastAPIHTTPException

    def _quota_exceeded():
        raise FastAPIHTTPException(status_code=402, detail="Guest quota exceeded")

    saved = dict(app.dependency_overrides)
    app.dependency_overrides[get_db_client] = lambda: mock_db_client
    app.dependency_overrides[get_video_processor] = lambda: mock_video_processor
    app.dependency_overrides[get_current_user] = _quota_exceeded
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            response = await ac.post("/api/process-video", data={"video_url": "https://youtube.com/watch?v=123"})
        assert response.status_code == 402
        assert "quota" in response.json()["detail"].lower()
    finally:
        app.dependency_overrides = saved

@pytest.mark.asyncio
async def test_retry_output(api_client, mock_db_client):
    with patch("api.routes.tasks.handle_retry_output") as mock_handle:
        response = await api_client.post("/api/retry-output", data={"output_id": "out_123"})
        assert response.status_code == 200
        mock_db_client.update_output_status.assert_called_with("out_123", status="pending", progress=0, error="")

@pytest.mark.asyncio
async def test_update_task_title(api_client, mock_db_client):
    mock_db_client.get_task.return_value = {"user_id": "test_user_id"}
    
    response = await api_client.patch("/api/tasks/task_123", json={"video_title": "New Title"})
    assert response.status_code == 200
    mock_db_client.update_task_status.assert_called_with("task_123", video_title="New Title")

@pytest.mark.asyncio
async def test_update_task_title_not_owner(api_client, mock_db_client):
    mock_db_client.get_task.return_value = {"user_id": "other_user"}
    
    response = await api_client.patch("/api/tasks/task_123", json={"video_title": "New Title"})
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_get_task_status(api_client, mock_db_client):
    mock_db_client.get_task.return_value = {
        "id": "task_123",
        "user_id": "test_user_id",
        "status": "completed",
        "progress": 100
    }
    
    response = await api_client.get("/api/tasks/task_123/status")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "task_123"

@pytest.mark.asyncio
async def test_get_task_status_not_found(api_client, mock_db_client):
    mock_db_client.get_task.return_value = None
    response = await api_client.get("/api/tasks/task_123/status")
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_unauthorized_access(mock_db_client):
    """Test that invalid auth token returns 401 when all bypasses are disabled."""
    saved_overrides = dict(app.dependency_overrides)
    try:
        # Only override db_client, do NOT override get_current_user
        # so the real auth logic runs
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides[get_db_client] = lambda: mock_db_client

        # Ensure validate_token returns None (invalid token)
        mock_db_client.validate_token.return_value = None

        # Disable ALL bypass paths: DEV_AUTH_BYPASS and MOCK_MODE
        with patch("dependencies.settings") as mock_settings:
            mock_settings.MOCK_MODE = False
            with patch.dict(os.environ, {"DEV_AUTH_BYPASS": "0"}, clear=False):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as ac:
                    response = await ac.post(
                        "/api/process-video",
                        data={"video_url": "http://test"},
                        headers={"Authorization": "Bearer invalid"}
                    )
                    assert response.status_code == 401
    finally:
        app.dependency_overrides = saved_overrides
