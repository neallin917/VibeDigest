import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from typing import AsyncGenerator

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="module")
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Fixture for creating an async client to test the FastAPI app.
    Uses ASGITransport to interact with the app directly without running a server.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
