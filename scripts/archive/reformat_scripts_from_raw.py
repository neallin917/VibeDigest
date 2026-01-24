"""
Backfill/repair formatted transcript markdown (`kind=script`) from persisted raw Whisper segments (`kind=script_raw`).

Why:
- Users should never see a "Retry" button.
- Transcript formatting rules evolve; we want to re-render scripts from the single source of truth (script_raw)
  without re-downloading or re-transcribing.

Usage (safe by default):
  uv run scripts/reformat_scripts_from_raw.py --dry-run --limit 10

Apply updates:
  uv run scripts/reformat_scripts_from_raw.py --apply --limit 10

Target specific tasks:
  uv run scripts/reformat_scripts_from_raw.py --apply --task-id <uuid> --task-id <uuid>
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from supabase import create_client


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.transcriber import format_markdown_from_raw_segments  # noqa: E402


logger = logging.getLogger("reformat_scripts_from_raw")


@dataclass
class ScriptPair:
    task_id: str
    script_id: str
    script_raw_id: str
    language: str
    raw_segments: list[dict]
    script_content: str


def _setup_logging(debug: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in environment")
    return create_client(url, key)


def _safe_json_loads(s: str) -> dict[str, Any]:
    try:
        return json.loads(s)
    except Exception:
        return {}


def _fetch_latest_task_ids(sb, limit: int) -> list[str]:
    resp = (
        sb.table("tasks")
        .select("id")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [r["id"] for r in (resp.data or []) if r.get("id")]


def _fetch_outputs_for_task(sb, task_id: str) -> list[dict[str, Any]]:
    resp = (
        sb.table("task_outputs")
        .select("id,task_id,kind,status,locale,content,updated_at")
        .eq("task_id", task_id)
        .execute()
    )
    return resp.data or []


def _extract_script_pair(task_id: str, outputs: list[dict[str, Any]]) -> Optional[ScriptPair]:
    script = next((o for o in outputs if o.get("kind") == "script"), None)
    raw = next((o for o in outputs if o.get("kind") == "script_raw"), None)
    if not script or not raw:
        return None
    raw_content = raw.get("content") or ""
    payload = _safe_json_loads(raw_content)
    segments = payload.get("segments") or []
    if not isinstance(segments, list) or not segments:
        return None
    language = str(payload.get("language") or "unknown")
    return ScriptPair(
        task_id=task_id,
        script_id=str(script.get("id")),
        script_raw_id=str(raw.get("id")),
        language=language,
        raw_segments=segments,
        script_content=str(script.get("content") or ""),
    )


def _render_from_pair(pair: ScriptPair) -> str:
    return format_markdown_from_raw_segments(pair.raw_segments, detected_language=pair.language)


def main() -> int:
    parser = argparse.ArgumentParser(description="Reformat task_outputs(kind=script) from task_outputs(kind=script_raw).")
    parser.add_argument("--limit", type=int, default=10, help="How many most-recent tasks to scan (ignored if --task-id is provided).")
    parser.add_argument("--task-id", action="append", default=[], help="Task ID to target (can be repeated).")
    parser.add_argument("--apply", action="store_true", help="Actually write updates to Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write; only report what would change.")
    parser.add_argument("--debug", action="store_true", help="Enable debug logs.")
    args = parser.parse_args()

    _setup_logging(args.debug)

    # Safe by default: require --apply to write.
    apply_changes = bool(args.apply) and not bool(args.dry_run)
    if args.apply and args.dry_run:
        logger.warning("Both --apply and --dry-run set; running in dry-run mode.")
        apply_changes = False

    sb = _get_supabase()

    task_ids = [t for t in args.task_id if t]
    if not task_ids:
        task_ids = _fetch_latest_task_ids(sb, limit=max(1, args.limit))

    scanned = 0
    candidates = 0
    updated = 0
    skipped_same = 0
    skipped_missing = 0

    for task_id in task_ids:
        scanned += 1
        outputs = _fetch_outputs_for_task(sb, task_id)
        pair = _extract_script_pair(task_id, outputs)
        if not pair:
            skipped_missing += 1
            logger.info(f"[{task_id}] skip (missing script/script_raw or empty segments)")
            continue

        candidates += 1
        new_md = _render_from_pair(pair)
        if new_md.strip() == pair.script_content.strip():
            skipped_same += 1
            logger.info(f"[{task_id}] unchanged (script already matches latest formatting)")
            continue

        logger.info(
            f"[{task_id}] will update script={pair.script_id} from raw={pair.script_raw_id} "
            f"(lang={pair.language}, segments={len(pair.raw_segments)}, old_len={len(pair.script_content)}, new_len={len(new_md)})"
        )

        if apply_changes:
            sb.table("task_outputs").update(
                {"content": new_md, "status": "completed", "progress": 100, "error_message": ""}
            ).eq("id", pair.script_id).execute()
            updated += 1

    logger.info(
        f"Done. scanned={scanned} candidates={candidates} updated={updated} "
        f"unchanged={skipped_same} skipped_missing={skipped_missing} apply={apply_changes}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


