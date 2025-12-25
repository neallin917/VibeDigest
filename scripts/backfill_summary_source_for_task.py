"""
Backfill `summary_source` (source-language anchored summary) and refresh `summary` for an existing task.

Goal:
- Reuse existing outputs where possible (script/script_raw).
- Avoid re-download/re-transcribe.
- Generate a stable source-language summary (anchored to script_raw timeline).
- Translate that summary JSON to the task's requested summary locale (if available) while preserving anchors.

Usage (must use uv):
  uv run scripts/backfill_summary_source_for_task.py --task-id <uuid> --dry-run
  uv run scripts/backfill_summary_source_for_task.py --task-id <uuid> --apply

Env required:
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
  OPENAI_API_KEY (and optional OPENAI_BASE_URL)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load backend env (SUPABASE_URL / SUPABASE_SERVICE_KEY / OPENAI_API_KEY etc.)
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

from backend.db_client import DBClient  # noqa: E402
from backend.summarizer import Summarizer  # noqa: E402


logger = logging.getLogger("backfill_summary_source_for_task")


def _configure_logging(debug: bool) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def _find_output(outputs: list[dict], kind: str) -> Optional[dict]:
    return next((o for o in outputs if o.get("kind") == kind), None)


def _parse_script_raw_language(script_raw_json: str) -> str:
    try:
        payload = json.loads(script_raw_json)
        if isinstance(payload, dict):
            return str(payload.get("language") or "unknown")
    except Exception:
        pass
    return "unknown"


async def run(task_id: str, *, dry_run: bool, debug: bool, force: bool) -> int:
    _configure_logging(debug)

    db = DBClient()
    s = Summarizer()

    task = db.get_task(task_id)
    if not task:
        logger.error("Task not found: %s", task_id)
        return 2

    user_id = task.get("user_id")
    video_title = task.get("video_title") or ""

    outputs = db.get_task_outputs(task_id)
    script_out = _find_output(outputs, "script")
    script_raw_out = _find_output(outputs, "script_raw")
    summary_out = _find_output(outputs, "summary")
    summary_source_out = _find_output(outputs, "summary_source")

    if not script_out or script_out.get("status") != "completed" or not script_out.get("content"):
        logger.error("Missing completed script output; cannot backfill without re-transcribing.")
        return 3
    if not script_raw_out or script_raw_out.get("status") != "completed" or not script_raw_out.get("content"):
        logger.error("Missing completed script_raw output; cannot anchor without raw segments.")
        return 4

    script_text = script_out["content"]
    script_raw_json = script_raw_out["content"]
    transcript_language = _parse_script_raw_language(script_raw_json)

    requested_lang = (summary_out or {}).get("locale") or transcript_language

    logger.info("Task: %s", task_id)
    logger.info("Transcript language: %s", transcript_language)
    logger.info("Requested summary locale: %s", requested_lang)

    if not summary_source_out:
        if not user_id:
            logger.error("Task missing user_id; cannot create summary_source output.")
            return 5
        logger.info("summary_source output missing; will create it.")
        if not dry_run:
            summary_source_out = db.create_task_output(task_id, user_id, kind="summary_source")
            outputs = db.get_task_outputs(task_id)
            summary_source_out = _find_output(outputs, "summary_source")

    if not summary_out:
        if not user_id:
            logger.error("Task missing user_id; cannot create summary output.")
            return 6
        logger.info("summary output missing; will create it (locale=%s).", requested_lang)
        if not dry_run:
            summary_out = db.create_task_output(task_id, user_id, kind="summary", locale=requested_lang)
            outputs = db.get_task_outputs(task_id)
            summary_out = _find_output(outputs, "summary")

    # Decide whether to skip if already present
    if summary_source_out and summary_source_out.get("status") == "completed" and summary_source_out.get("content") and not force:
        logger.info("summary_source already completed; use --force to regenerate.")
        source_summary_json = summary_source_out.get("content")
    else:
        logger.info("Generating anchored summary_source (reuses script/script_raw; no download/transcribe).")
        source_summary_json = await s.summarize_in_language_with_anchors(
            script_text,
            summary_language=transcript_language,
            video_title=video_title,
            script_raw_json=script_raw_json,
        )
        if summary_source_out:
            if dry_run:
                logger.info("[dry-run] Would update summary_source output %s", summary_source_out.get("id"))
            else:
                db.update_output_status(summary_source_out["id"], status="completed", progress=100, content=source_summary_json, error="")

    # Translate to requested summary language if needed
    if not source_summary_json:
        logger.error("Failed to produce source summary JSON.")
        return 7

    if str(requested_lang).lower() != str(transcript_language).lower():
        logger.info("Translating summary to requested locale (preserving anchors).")
        translated = await s.translate_summary_json(source_summary_json, target_language=requested_lang)
    else:
        translated = source_summary_json

    if summary_out:
        if dry_run:
            logger.info("[dry-run] Would update summary output %s", summary_out.get("id"))
        else:
            db.update_output_status(summary_out["id"], status="completed", progress=100, content=translated, error="")

    logger.info("Done.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill summary_source + refresh summary for a task (reuse existing outputs).")
    parser.add_argument("--task-id", required=True, help="Task UUID")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to DB; only log actions (default)")
    parser.add_argument("--apply", action="store_true", help="Write changes to DB")
    parser.add_argument("--debug", action="store_true", help="Verbose logging")
    parser.add_argument("--force", action="store_true", help="Regenerate even if summary_source already exists")
    args = parser.parse_args()

    try:
        import asyncio

        # Safe default: dry-run unless explicitly applied.
        dry_run = True
        if args.apply:
            dry_run = False
        if args.dry_run:
            dry_run = True
        return asyncio.run(run(args.task_id, dry_run=dry_run, debug=args.debug, force=args.force))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())


