import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from config import settings


PROVIDERS_DIR = Path(__file__).parent.parent / "configs" / "providers"


def _read_yaml_file(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Invalid provider config: {path}")
    return data


class ModelRegistry:
    """
    Loads provider + model metadata from YAML and merges env overrides.

    This is the SSOT for model definitions and defaults.
    """

    def __init__(self, providers_dir: Path = PROVIDERS_DIR) -> None:
        self.providers_dir = providers_dir
        self._cache: Optional[Dict[str, Any]] = None

    def _load_providers(self) -> List[Dict[str, Any]]:
        providers: List[Dict[str, Any]] = []
        if not self.providers_dir.exists():
            return providers

        for path in sorted(self.providers_dir.glob("*.yaml")):
            data = _read_yaml_file(path)
            providers.append(data)
        return providers

    def _apply_env_overrides(self, provider: Dict[str, Any]) -> Dict[str, Any]:
        merged = dict(provider)
        defaults = dict(merged.get("defaults") or {})

        base_url_env = merged.get("base_url_env")
        api_key_env = merged.get("api_key_env")

        merged["base_url"] = os.getenv(base_url_env) if base_url_env else None
        merged["has_api_key"] = bool(os.getenv(api_key_env)) if api_key_env else False

        if merged.get("provider") == settings.LLM_PROVIDER:
            if settings.MODEL_ALIAS_SMART:
                defaults["smart"] = settings.MODEL_ALIAS_SMART
            if settings.MODEL_ALIAS_FAST:
                defaults["fast"] = settings.MODEL_ALIAS_FAST

        merged["defaults"] = defaults
        return merged

    def refresh(self) -> Dict[str, Any]:
        providers = [self._apply_env_overrides(p) for p in self._load_providers()]
        payload = {
            "active_provider": settings.LLM_PROVIDER,
            "providers": providers,
        }
        self._cache = payload
        return payload

    def get_all(self) -> Dict[str, Any]:
        # Invalidate cache when active provider changes (e.g. LLM_PROVIDER env override in tests)
        if self._cache is None or self._cache.get("active_provider") != settings.LLM_PROVIDER:
            return self.refresh()
        return self._cache

    def get_provider(self, provider_name: str) -> Optional[Dict[str, Any]]:
        data = self.get_all()
        for provider in data.get("providers", []):
            if provider.get("provider") == provider_name:
                return provider
        return None


_REGISTRY = ModelRegistry()


def get_model_registry() -> ModelRegistry:
    return _REGISTRY
