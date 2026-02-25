import pytest
from unittest.mock import MagicMock, patch, ANY
import os
from db_client import DBClient
from sqlalchemy import text

@pytest.fixture
def mock_engine():
    return MagicMock()

@pytest.fixture
def mock_session():
    return MagicMock()

@pytest.fixture
def db_client_instance(mock_engine, mock_session):
    with (
        patch("db_client.create_engine", return_value=mock_engine),
        patch("db_client.scoped_session", return_value=MagicMock(return_value=mock_session)),
        patch.dict(os.environ, {
            "DATABASE_URL": "postgresql://test:test@localhost/test",
            "SUPABASE_JWT_SECRET": "test-jwt-secret",
        })
    ):
        client = DBClient()
        # Ensure session factory returns our mock session
        client.Session = MagicMock(return_value=mock_session)
        return client

def test_create_task(db_client_instance, mock_session):
    mock_result = MagicMock()
    mock_result.returns_rows = True
    mock_result.__iter__.return_value = iter([{"id": "task_1", "user_id": "u1", "status": "pending"}])
    mock_session.execute.return_value = mock_result
    
    # Mock row mapping
    row = MagicMock()
    row._mapping = {"id": "task_1", "user_id": "u1", "status": "pending"}
    mock_result.__iter__.return_value = iter([row])

    result = db_client_instance.create_task("u1", "http://vid", "Title")
    
    assert result["id"] == "task_1"
    mock_session.execute.assert_called()
    mock_session.commit.assert_called()

def test_get_task(db_client_instance, mock_session):
    mock_result = MagicMock()
    mock_result.returns_rows = True
    row = MagicMock()
    row._mapping = {"id": "task_1", "status": "completed"}
    mock_result.__iter__.return_value = iter([row])
    mock_session.execute.return_value = mock_result

    result = db_client_instance.get_task("task_1")
    assert result["id"] == "task_1"

def test_update_task_status(db_client_instance, mock_session):
    db_client_instance.update_task_status("task_1", status="processing", progress=50)
    
    # Verify execute called with update statement
    mock_session.execute.assert_called()
    args, kwargs = mock_session.execute.call_args
    sql_text = args[0].text
    assert "UPDATE tasks SET" in sql_text
    assert "status = :status" in sql_text
    assert "progress = :progress" in sql_text
    
    # Check params. They are usually the 2nd positional arg.
    if len(args) > 1:
        params = args[1]
    else:
        params = kwargs.get("params", {}) # But execute usually takes params as pos arg 2
        
    # If using text(query), parameters are passed as the second argument to execute
    assert params["status"] == "processing"
    assert params["progress"] == 50

def test_create_task_output(db_client_instance, mock_session):
    mock_result = MagicMock()
    mock_result.returns_rows = True
    row = MagicMock()
    row._mapping = {"id": "out_1", "kind": "script"}
    mock_result.__iter__.return_value = iter([row])
    mock_session.execute.return_value = mock_result

    result = db_client_instance.create_task_output("task_1", "u1", "script")
    assert result["id"] == "out_1"

def test_get_task_outputs(db_client_instance, mock_session):
    mock_result = MagicMock()
    mock_result.returns_rows = True
    row1 = MagicMock()
    row1._mapping = {"id": "out_1", "kind": "script"}
    row2 = MagicMock()
    row2._mapping = {"id": "out_2", "kind": "summary"}
    mock_result.__iter__.return_value = iter([row1, row2])
    mock_session.execute.return_value = mock_result

    results = db_client_instance.get_task_outputs("task_1")
    assert len(results) == 2

def test_validate_token_success(db_client_instance):
    with patch('db_client.jwt.decode', return_value={"sub": "u1"}):
        user_id = db_client_instance.validate_token("Bearer token")
        assert user_id == "u1"

def test_validate_token_failure(db_client_instance):
    import jwt as pyjwt
    with patch('db_client.jwt.decode', side_effect=pyjwt.InvalidTokenError("bad")):
        user_id = db_client_instance.validate_token("token")
        assert user_id is None

def test_check_and_consume_quota_success(db_client_instance, mock_session):
    # Mock get_profile
    mock_result_profile = MagicMock()
    mock_result_profile.returns_rows = True
    row_prof = MagicMock()
    row_prof._mapping = {"id": "u1", "usage_count": 0, "usage_limit": 3, "extra_credits": 0}
    
    # Mock update
    mock_result_update = MagicMock()
    
    mock_session.execute.side_effect = [
        mock_result_profile, # get_profile response
        mock_result_update   # update response
    ]
    mock_result_profile.__iter__.return_value = iter([row_prof])

    assert db_client_instance.check_and_consume_quota("u1") is True
    assert mock_session.commit.call_count >= 1

def test_check_and_consume_quota_failed(db_client_instance, mock_session):
    # Mock get_profile returning usage = limit
    mock_result_profile = MagicMock()
    mock_result_profile.returns_rows = True
    row_prof = MagicMock()
    row_prof._mapping = {"id": "u1", "usage_count": 3, "usage_limit": 3, "extra_credits": 0}
    mock_result_profile.__iter__.return_value = iter([row_prof])

    mock_session.execute.return_value = mock_result_profile
    
    assert db_client_instance.check_and_consume_quota("u1") is False

def test_check_and_consume_quota_extra_credits(db_client_instance, mock_session):
    # Mock get_profile returning usage = limit but extra credits
    mock_result_profile = MagicMock()
    mock_result_profile.returns_rows = True
    row_prof = MagicMock()
    row_prof._mapping = {"id": "u1", "usage_count": 3, "usage_limit": 3, "extra_credits": 1}
    mock_result_profile.__iter__.return_value = iter([row_prof])
    
    mock_session.execute.side_effect = [
        mock_result_profile, # get_profile
        MagicMock()          # update extra_credits
    ]

    assert db_client_instance.check_and_consume_quota("u1") is True
