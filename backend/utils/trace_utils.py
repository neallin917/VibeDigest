import os
from typing import Any, Dict, Iterable, List, Optional


def _infer_env_tag() -> str:
    env = (
        os.getenv("APP_ENV")
        or os.getenv("ENV")
        or os.getenv("NODE_ENV")
        or ""
    ).strip().lower()

    if env in ("prod", "production", "release"):
        return "env:prod"
    if env in ("dev", "development", "local", "test"):
        return "env:dev"

    frontend_url = (os.getenv("FRONTEND_URL") or "").lower()
    if any(host in frontend_url for host in ("localhost", "127.0.0.1", "0.0.0.0")):
        return "env:dev"
    if frontend_url:
        return "env:prod"

    return "env:dev"


def _coerce_tags(tags: Optional[Iterable[str]]) -> List[str]:
    if not tags:
        return []
    if isinstance(tags, str):
        return [tags]
    return [t for t in tags if t]


def _merge_tags(*tag_lists: Iterable[str]) -> List[str]:
    merged: List[str] = []
    for tags in tag_lists:
        for tag in _coerce_tags(tags):
            if tag not in merged:
                merged.append(tag)
    return merged


def build_trace_config(
    *,
    run_name: Optional[str] = None,
    task_id: Optional[str] = None,
    user_id: Optional[str] = None,
    stage: Optional[str] = None,
    source: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    tags: Optional[Iterable[str]] = None,
    base: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    base = base or {}

    base_metadata = dict(base.get("metadata", {}) or {})
    if task_id and "task_id" not in base_metadata:
        base_metadata["task_id"] = task_id
    if user_id and "user_id" not in base_metadata:
        base_metadata["user_id"] = user_id

    merged_metadata = {**base_metadata, **(metadata or {})}

    env_tag = _infer_env_tag()
    stage_tag = f"stage:{stage}" if stage else None
    source_tag = f"source:{source}" if source else None

    merged_tags = _merge_tags(
        base.get("tags", []),
        tags or [],
        [env_tag] if env_tag else [],
        [stage_tag] if stage_tag else [],
        [source_tag] if source_tag else [],
    )

    session_id = base.get("session_id") or (str(task_id) if task_id else None)

    config: Dict[str, Any] = {
        k: v
        for k, v in base.items()
        if k not in ("run_name", "name", "metadata", "tags", "session_id")
    }

    resolved_run_name = run_name or base.get("run_name") or base.get("name")
    if resolved_run_name:
        config["run_name"] = resolved_run_name
    if session_id:
        config["session_id"] = session_id
    if merged_metadata:
        config["metadata"] = merged_metadata
    if merged_tags:
        config["tags"] = merged_tags

    return config
