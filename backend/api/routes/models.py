from fastapi import APIRouter

from utils.model_registry import get_model_registry

router = APIRouter()


@router.get("/models/providers")
async def list_model_providers():
    registry = get_model_registry()
    payload = registry.get_all()
    return payload


@router.get("/models/providers/{provider}")
async def get_model_provider(provider: str):
    registry = get_model_registry()
    data = registry.get_provider(provider)
    if not data:
        return {"error": "provider_not_found", "provider": provider}
    return data
