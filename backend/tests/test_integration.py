import pytest
from unittest.mock import patch
from httpx import AsyncClient
from sqlalchemy import text
from main import app
from dependencies import get_current_user, get_db_client
from db_client import DBClient

# --- Authentication Mock ---
# Bypass Supabase token validation logic in main.py,
# but we MUST ensure this user exists in our Test DB (auth.users)
TEST_USER_ID = "00000000-0000-0000-0000-000000000001"

async def mock_get_current_user():
    return TEST_USER_ID

app.dependency_overrides[get_current_user] = mock_get_current_user

@pytest.fixture(autouse=True)
def setup_test_data(async_client): # Require async_client to ensure DB override is in place
    """Ensure test user exists in DB before each test."""
    # Get the client being used (which is the test one from conftest via override)
    try:
        db = app.dependency_overrides[get_db_client]()
    except KeyError:
        # Fallback if override isn't set (shouldn't happen with async_client fixture)
        return

    if not db.engine:
        return # Skip if engine not ready (unexpected)

    with db.engine.connect() as conn:
        # 1. Create fake user in auth.users
        conn.execute(text("""
            INSERT INTO auth.users (id, email)
            VALUES (:uid, 'test@example.com')
            ON CONFLICT (id) DO NOTHING
        """), {"uid": TEST_USER_ID})

        # 2. Create profile with credits
        conn.execute(text("""
            INSERT INTO public.profiles (id, tier, usage_limit, usage_count)
            VALUES (:uid, 'free', 100, 0)
            ON CONFLICT (id) DO UPDATE SET usage_count = 0
        """), {"uid": TEST_USER_ID})

        # Clean tasks
        conn.execute(text("DELETE FROM task_outputs"))
        conn.execute(text("DELETE FROM tasks"))

        conn.commit()

@pytest.mark.asyncio
async def test_process_video_endpoint_real_db(async_client: AsyncClient):
    """
    Test creating a video task using REAL DB (Postgres Container).
    We still Mock `run_pipeline` to avoid executing actual video processing logic
    (download, transcribe) which takes time and costs tokens.
    """
    # We patch run_pipeline in the routes module to prevent background tasks
    with patch("api.routes.tasks.run_pipeline") as mock_pipeline:

        payload = {
            "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "summary_language": "zh"
        }

        response = await async_client.post("/api/process-video", data=payload)

        assert response.status_code == 200, f"Response: {response.text}"
        data = response.json()
        task_id = data["task_id"]
        assert task_id

        # --- VERIFY DB SIDE EFFECTS ---
        db = app.dependency_overrides[get_db_client]()
        with db.engine.connect() as conn:
            # 1. Check Task Created
            res = conn.execute(text("SELECT * FROM tasks WHERE id = :tid"), {"tid": task_id}).fetchone()
            assert res is not None
            assert str(res._mapping["user_id"]) == TEST_USER_ID
            assert res._mapping["video_url"] == "https://youtube.com/watch?v=dQw4w9WgXcQ" # URL is normalized

            # 2. Check Outputs Created
            res_outs = conn.execute(text("SELECT * FROM task_outputs WHERE task_id = :tid"), {"tid": task_id}).fetchall()
            kinds = [row._mapping["kind"] for row in res_outs]
            assert "script" in kinds
            assert "summary" in kinds

            # 3. Check Quota Usage (Profile usage_count should depend on logic)
            # Default logic checks usage < limit, then increments.
            res_prof = conn.execute(text("SELECT usage_count FROM profiles WHERE id = :uid"), {"uid": TEST_USER_ID}).fetchone()
            assert res_prof._mapping["usage_count"] == 1

        # Verify Pipeline was triggered
        args, _ = mock_pipeline.call_args
        assert str(args[0]) == task_id


@pytest.mark.asyncio
async def test_process_video_quota_exceeded_real_db(async_client: AsyncClient):
    """
    Test behavior when user has no credits (Real DB).
    """
    # Set usage to limit
    db = app.dependency_overrides[get_db_client]()
    with db.engine.connect() as conn:
        conn.execute(text("UPDATE profiles SET usage_count = 100, usage_limit = 3 WHERE id = :uid"), {"uid": TEST_USER_ID})
        conn.commit()

    payload = {
        "video_url": "https://example.com/nofunds",
        "summary_language": "en"
    }

    response = await async_client.post("/api/process-video", data=payload)

    assert response.status_code == 402
    assert "Quota exceeded" in response.json()["detail"]
