"""
One-off backfill script:
- Find most recent task_outputs(kind="script") that still contain the old formatted transcript
  (timestamps / "Video Transcription" headings).
- For each, load task_outputs(kind="script_raw") for the same task_id, re-render transcript from raw segments,
  then convert to the new "clean script" format (timestamp-free, meta-free).
- Update the existing task_outputs(kind="script") content in Supabase.

Run with uv (repo convention):
  uv run scripts/backfill_latest_scripts_from_raw.py --limit 50          # dry-run (default)
  uv run scripts/backfill_latest_scripts_from_raw.py --limit 50 --apply  # write changes

Notes:
- Safe by default: does NOT write unless --apply is provided.
- By default, does NOT call OpenAI even if OPENAI_API_KEY is configured (to avoid surprise costs).
  Use --use-openai to match the pipeline's optimize_transcript() behavior.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

# Ensure repo root is on sys.path so we can import backend modules when running as a script.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load backend env (SUPABASE_URL / SUPABASE_SERVICE_KEY / optional OPENAI_API_KEY)
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

from backend.db_client import DBClient  # noqa: E402
from backend.summarizer import Summarizer  # noqa: E402
from backend.transcriber import format_markdown_from_raw_segments  # noqa: E402


logger = logging.getLogger("backfill_latest_scripts_from_raw")


OLD_SCRIPT_PATTERNS: List[re.Pattern[str]] = [
    re.compile(r"^#\s*Video Transcription\b", re.I | re.M),
    re.compile(r"^##\s*Transcription Content\b", re.I | re.M),
    re.compile(r"\*\*\[([0-9]{1,2}:)?[0-9]{2}:[0-9]{2}\]\*\*", re.M),  # **[MM:SS]** / **[HH:MM:SS]**
    re.compile(r"\*\*Detected Language:\*\*", re.I),
]


def setup_logging(debug: bool) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s - %(message)s")


def looks_like_old_script(content: str) -> bool:
    if not content:
        return False
    s = content.strip()
    if not s:
        return False
    for pat in OLD_SCRIPT_PATTERNS:
        if pat.search(s):
            return True
    return False


def chunked(seq: List[str], size: int) -> List[List[str]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def fetch_latest_script_outputs(db: DBClient, limit: int, offset: int) -> List[Dict[str, Any]]:
    if not db.supabase:
        raise RuntimeError("Supabase client not initialized (missing SUPABASE_URL/SUPABASE_SERVICE_KEY).")
    resp = (
        db.supabase.table("task_outputs")
        .select("id,task_id,content,status,updated_at,created_at")
        .eq("kind", "script")
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return resp.data or []


def fetch_script_raw_by_task_ids(db: DBClient, task_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """
    Returns mapping task_id -> script_raw row.
    """
    if not db.supabase:
        raise RuntimeError("Supabase client not initialized.")
    out: Dict[str, Dict[str, Any]] = {}
    if not task_ids:
        return out

    # Supabase "in" list can be large but to be safe, chunk it.
    for batch in chunked(task_ids, 100):
        resp = (
            db.supabase.table("task_outputs")
            .select("id,task_id,content,updated_at,created_at")
            .eq("kind", "script_raw")
            .in_("task_id", batch)
            .execute()
        )
        for row in resp.data or []:
            tid = row.get("task_id")
            if tid and tid not in out:
                out[tid] = row
    return out


def render_clean_script_from_raw(
    summarizer: Summarizer,
    *,
    raw_json: str,
    use_openai: bool,
) -> Tuple[str, str]:
    """
    Returns (clean_script_text, detected_language_code).
    """
    payload = json.loads(raw_json or "{}")
    raw_segments = payload.get("segments", []) or []
    detected_language = (payload.get("language") or "unknown") or "unknown"
    md_with_timestamps = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)

    if use_openai:
        # Match pipeline behavior (may call OpenAI; costs money).
        # optimize_transcript is async.
        raise RuntimeError("use_openai requires async path")

    # Safe, deterministic clean: remove timestamps and meta headings; normalize paragraphs.
    cleaned = summarizer._remove_timestamps_and_meta(md_with_timestamps)  # noqa: SLF001
    cleaned = summarizer._ensure_markdown_paragraphs(cleaned)  # noqa: SLF001
    return cleaned, str(detected_language).lower()


async def render_clean_script_from_raw_async(
    summarizer: Summarizer,
    *,
    raw_json: str,
    use_openai: bool,
) -> Tuple[str, str]:
    payload = json.loads(raw_json or "{}")
    raw_segments = payload.get("segments", []) or []
    detected_language = (payload.get("language") or "unknown") or "unknown"
    md_with_timestamps = format_markdown_from_raw_segments(raw_segments, detected_language=detected_language)

    if use_openai:
        cleaned = await summarizer.optimize_transcript(md_with_timestamps)
    else:
        cleaned = summarizer._remove_timestamps_and_meta(md_with_timestamps)  # noqa: SLF001
        cleaned = summarizer._ensure_markdown_paragraphs(cleaned)  # noqa: SLF001

    return cleaned, str(detected_language).lower()


def update_script_output(db: DBClient, script_output_id: str, new_content: str, *, dry_run: bool) -> None:
    if dry_run:
        logger.info("[dry-run] would update script output id=%s (len=%d)", script_output_id, len(new_content))
        return

    if not db.supabase:
        raise RuntimeError("Supabase client not initialized.")

    db.supabase.table("task_outputs").update(
        {
            "content": new_content,
            "status": "completed",
            "progress": 100,
            "error_message": "",
            "updated_at": "now()",
        }
    ).eq("id", script_output_id).execute()


async def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill latest old-format script outputs from script_raw.")
    parser.add_argument("--limit", type=int, default=50, help="How many recent script outputs to scan (default: 50).")
    parser.add_argument("--offset", type=int, default=0, help="Pagination offset (default: 0).")
    parser.add_argument("--apply", action="store_true", help="Write changes to Supabase (default: dry-run).")
    parser.add_argument(
        "--use-openai",
        action="store_true",
        help="Use OpenAI optimize_transcript() for backfill (may incur costs). Default is deterministic cleaning only.",
    )
    parser.add_argument(
        "--task-ids",
        type=str,
        default="",
        help='Comma-separated task IDs to backfill (overrides limit/offset scan). Example: "id1,id2".',
    )
    parser.add_argument("--debug", action="store_true", help="Verbose logging.")
    args = parser.parse_args()

    setup_logging(args.debug)
    dry_run = not args.apply

    db = DBClient()
    if not db.supabase:
        logger.error("Supabase client not available. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.")
        return 2

    summarizer = Summarizer()

    # Determine candidate script outputs
    candidates: List[Dict[str, Any]] = []
    if args.task_ids.strip():
        task_ids = [t.strip() for t in args.task_ids.split(",") if t.strip()]
        if not task_ids:
            logger.error("--task-ids provided but empty after parsing.")
            return 2
        # Fetch script outputs for these task_ids
        resp = (
            db.supabase.table("task_outputs")
            .select("id,task_id,content,status,updated_at,created_at")
            .eq("kind", "script")
            .in_("task_id", task_ids)
            .execute()
        )
        candidates = resp.data or []
        logger.info("Fetched %d script outputs by task_ids.", len(candidates))
    else:
        candidates = fetch_latest_script_outputs(db, limit=args.limit, offset=args.offset)
        logger.info("Fetched %d recent script outputs (offset=%d, limit=%d).", len(candidates), args.offset, args.limit)

    # Filter old-format scripts
    old_scripts = [c for c in candidates if looks_like_old_script(str(c.get("content") or ""))]
    if not old_scripts:
        logger.info("No old-format scripts found in this batch.")
        return 0

    task_ids_needed = sorted({str(c.get("task_id")) for c in old_scripts if c.get("task_id")})
    raw_by_task = fetch_script_raw_by_task_ids(db, task_ids_needed)

    updated = 0
    skipped = 0
    failed = 0

    logger.info("Found %d old-format scripts. script_raw available for %d tasks.", len(old_scripts), len(raw_by_task))
    if dry_run:
        logger.info("Running in dry-run mode. Use --apply to write changes.")
    if args.use_openai:
        logger.warning("OpenAI mode enabled (--use-openai). This may incur API costs.")

    for row in old_scripts:
        script_id = row.get("id")
        task_id = row.get("task_id")
        if not script_id or not task_id:
            skipped += 1
            continue

        raw_row = raw_by_task.get(str(task_id))
        if not raw_row or not raw_row.get("content"):
            logger.warning("Skipping task=%s script_id=%s: missing script_raw.", task_id, script_id)
            skipped += 1
            continue

        try:
            clean_text, detected_lang = await render_clean_script_from_raw_async(
                summarizer, raw_json=str(raw_row["content"]), use_openai=bool(args.use_openai)
            )
            if not clean_text.strip():
                raise ValueError("Rendered empty clean script")

            logger.info("Backfilling task=%s script_id=%s detected_lang=%s", task_id, script_id, detected_lang)
            update_script_output(db, str(script_id), clean_text, dry_run=dry_run)
            updated += 1
        except Exception as e:
            failed += 1
            logger.error("Failed task=%s script_id=%s: %s", task_id, script_id, e)

    logger.info("Done. updated=%d skipped=%d failed=%d dry_run=%s", updated, skipped, failed, dry_run)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))


