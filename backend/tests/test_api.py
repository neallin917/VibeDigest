import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient):
    """
    Test the root endpoint / health check.
    """
    response = await async_client.get("/")
    assert response.status_code == 200
    # Assuming the root returns some message, verify basic JSON structure
    assert response.json() is not None

@pytest.mark.asyncio
async def test_404_not_found(async_client: AsyncClient):
    """
    Test a non-existent endpoint.
    """
    response = await async_client.get("/non-existent-endpoint")
    assert response.status_code == 404
