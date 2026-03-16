"""Tests for api/routes/models.py — model provider endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routes.models import router


def _make_app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def mock_registry():
    registry = MagicMock()
    registry.get_all.return_value = {
        "openai": {"defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}},
        "anthropic": {"defaults": {"smart": "claude-3-opus", "fast": "claude-3-haiku"}},
    }
    registry.get_provider.side_effect = lambda name: {
        "openai": {"defaults": {"smart": "gpt-4o", "fast": "gpt-4o-mini"}},
    }.get(name)
    return registry


@pytest.fixture
def client(mock_registry):
    with patch("api.routes.models.get_model_registry", return_value=mock_registry):
        app = _make_app()
        with TestClient(app) as c:
            yield c, mock_registry


# ---------------------------------------------------------------------------
# GET /models/providers
# ---------------------------------------------------------------------------

class TestListModelProviders:
    def test_returns_200(self, client):
        c, _ = client
        response = c.get("/models/providers")
        assert response.status_code == 200

    def test_returns_all_providers(self, client):
        c, _ = client
        data = response = c.get("/models/providers").json()
        assert "openai" in data
        assert "anthropic" in data

    def test_calls_registry_get_all(self, client):
        c, registry = client
        c.get("/models/providers")
        registry.get_all.assert_called_once()


# ---------------------------------------------------------------------------
# GET /models/providers/{provider}
# ---------------------------------------------------------------------------

class TestGetModelProvider:
    def test_known_provider_returns_data(self, client):
        c, _ = client
        response = c.get("/models/providers/openai")
        assert response.status_code == 200
        data = response.json()
        assert "defaults" in data
        assert data["defaults"]["smart"] == "gpt-4o"

    def test_unknown_provider_returns_error(self, client):
        c, _ = client
        response = c.get("/models/providers/nonexistent_provider")
        assert response.status_code == 200
        data = response.json()
        assert data["error"] == "provider_not_found"
        assert data["provider"] == "nonexistent_provider"

    def test_calls_registry_get_provider(self, client):
        c, registry = client
        c.get("/models/providers/openai")
        registry.get_provider.assert_called_with("openai")
