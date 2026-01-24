"""
Backfill/rebuild `task_outputs(kind="script_raw")` for a specific task.

Why:
- Older tasks (or failed runs) may be missing `script_raw`, but the frontend timeline/seek features
  rely on raw Whisper segments (start/end/text).
- This script lets you "retrace" a task once and persist `script_raw` again.

Safety:
- Dry-run by default. Use --apply to write.
- Uses Supabase Service Role key (SUPABASE_SERVICE_KEY). Do NOT run against prod by accident.

Usage:
  # 1) See what would happen (no writes)
  uv run scripts/backfill_script_raw_for_task.py --task-id <uuid> --dry-run

  # 2) Apply (write script_raw, optionally re-render script)
  uv run scripts/backfill_script_raw_for_task.py --task-id <uuid> --apply

Notes:
- Preferred audio source is `task_outputs(kind="audio")` JSON content: {"audioUrl": "..."}.
- If not available or download fails, falls back to downloading via VideoProcessor from task.video_url.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional, Tuple
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load backend env (SUPABASE_URL / SUPABASE_SERVICE_KEY / OPENAI_API_KEY etc.)
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

from backend.db_client import DBClient  # noqa: E402
from backend.transcriber import Transcriber, format_markdown_from_raw_segments  # noqa: E402
from backend.summarizer import Summarizer  # noqa: E402
from backend.video_processor import VideoProcessor  # noqa: E402


logger = logging.getLogger("backfill_script_raw_for_task")


def setup_logging(debug: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _safe_json_loads(s: str) -> dict[str, Any]:
    try:
        return json.loads(s)
    except Exception:
        return {}


def _extract_audio_url_from_output(audio_output: dict[str, Any]) -> Optional[str]:
    content = (audio_output.get("content") or "").strip()
    if not content:
        return None
    if content.startswith("{"):
        obj = _safe_json_loads(content)
        url = obj.get("audioUrl")
        return url if isinstance(url, str) and url else None
    # legacy: plain url string
    return content if "://" in content else None


def _guess_ext_from_url(url: str) -> str:
    try:
        path = urlparse(url).path or ""
        ext = Path(path).suffix.lower()
        if ext in {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".opus"}:
            return ext
    except Exception:
        pass
    return ".mp3"


def _download_with_retries(url: str, dest: Path, timeout_seconds: float = 15.0) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    headers = {"User-Agent": "Mozilla/5.0 (compatible; VibeDigest/1.0)"}

    last_err: Optional[Exception] = None
    for attempt in range(1, 4):
        try:
            logger.info("Downloading audioUrl (attempt %d/3) -> %s", attempt, dest)
            with session.get(url, headers=headers, stream=True, timeout=timeout_seconds) as r:
                r.raise_for_status()
                with dest.open("wb") as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
            return
        except Exception as e:
            last_err = e
            sleep_s = min(2 ** attempt, 6)
            logger.warning("Download failed (attempt %d): %s; retrying in %ss", attempt, e, sleep_s)
            time.sleep(sleep_s)

    raise RuntimeError(f"Failed to download audio after retries: {last_err}")


def _ensure_output(db: DBClient, task_id: str, user_id: str, kind: str) -> dict[str, Any]:
    outputs = db.get_task_outputs(task_id)
    existing = next((o for o in outputs if o.get("kind") == kind), None)
    if existing:
        return existing
    return db.create_task_output(task_id, user_id, kind=kind)


def _has_valid_script_raw(script_raw_output: dict[str, Any]) -> bool:
    content = (script_raw_output.get("content") or "").strip()
    if not content:
        return False
    obj = _safe_json_loads(content)
    segs = obj.get("segments")
    return isinstance(segs, list) and len(segs) > 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill/rebuild task_outputs(kind=script_raw) for a specific task.")
    parser.add_argument("--task-id", required=True, help="Target task UUID.")
    parser.add_argument("--apply", action="store_true", help="Actually write updates to Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write; only report actions.")
    parser.add_argument("--debug", action="store_true", help="Verbose logging.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Rebuild even if script_raw already exists (overwrites content).",
    )
    parser.add_argument(
        "--no-update-script",
        action="store_true",
        help="Only write script_raw. Do not re-render/update kind=script.",
    )
    args = parser.parse_args()
    setup_logging(args.debug)

    apply_changes = bool(args.apply) and not bool(args.dry_run)
    if args.apply and args.dry_run:
        logger.warning("Both --apply and --dry-run set; running in dry-run mode.")
        apply_changes = False

    async def _run() -> int:
        db = DBClient()
        if not db.supabase:
            raise SystemExit("Supabase client not initialized. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.")

        task_id = args.task_id
        task = db.get_task(task_id)
        if not task:
            logger.error("Task not found: %s", task_id)
            return 2

        user_id = str(task.get("user_id") or "")
        video_url = str(task.get("video_url") or "")
        logger.info("Target task=%s user=%s url=%s", task_id, user_id, video_url)

        outputs = db.get_task_outputs(task_id)
        audio_output = next((o for o in outputs if o.get("kind") == "audio"), None)

        script_raw_out = _ensure_output(db, task_id, user_id, kind="script_raw")
        script_out = _ensure_output(db, task_id, user_id, kind="script")

        if _has_valid_script_raw(script_raw_out) and not args.force:
            logger.info("script_raw already present with segments. Nothing to do (use --force to rebuild).")
            return 0

        # Acquire audio file
        temp_dir = REPO_ROOT / "temp"
        temp_dir.mkdir(exist_ok=True)
        local_audio_path: Optional[Path] = None
        cleanup_paths: list[Path] = []

        audio_url = _extract_audio_url_from_output(audio_output) if audio_output else None
        if audio_url:
            ext = _guess_ext_from_url(audio_url)
            local_audio_path = temp_dir / f"backfill_{task_id.replace('-', '')}{ext}"
            try:
                if args.dry_run and not args.apply:
                    logger.info("[dry-run] would download audioUrl -> %s", local_audio_path)
                else:
                    _download_with_retries(audio_url, local_audio_path)
                cleanup_paths.append(local_audio_path)
            except Exception as e:
                logger.warning("audioUrl download failed; will fall back to VideoProcessor. err=%s", e)
                local_audio_path = None

        if not local_audio_path:
            if not video_url:
                logger.error("No audioUrl and task.video_url is empty; cannot backfill.")
                return 3
            vp = VideoProcessor()
            if args.dry_run and not args.apply:
                logger.info("[dry-run] would download+convert via VideoProcessor from video_url")
                return 0
            audio_path_str, _, _, _ = await vp.download_and_convert(video_url, temp_dir)
            local_audio_path = Path(audio_path_str)
            cleanup_paths.append(local_audio_path)

        # Transcribe with raw segments
        tr = Transcriber()
        summ = Summarizer()

        if args.dry_run and not args.apply:
            logger.info("[dry-run] would transcribe and write script_raw (and script unless --no-update-script)")
            return 0

        try:
            db.update_output_status(script_raw_out["id"], status="processing", progress=10, error="")
        except Exception:
            pass

        transcript_md_with_ts, raw_json, detected_language = await tr.transcribe_with_raw(str(local_audio_path))
        logger.info("Transcribed. detected_language=%s raw_len=%d", detected_language, len(raw_json or ""))

        if apply_changes:
            db.update_output_status(script_raw_out["id"], status="completed", progress=100, content=raw_json, error="")
        else:
            logger.info("[dry-run] would write script_raw content (%d chars)", len(raw_json or ""))

        if not args.no_update_script:
            payload = _safe_json_loads(raw_json or "{}")
            segments = payload.get("segments") or []
            language = str(payload.get("language") or detected_language or "unknown")
            md_with_ts = (
                format_markdown_from_raw_segments(segments, detected_language=language)
                if isinstance(segments, list)
                else transcript_md_with_ts
            )
            try:
                clean = await summ.optimize_transcript(md_with_ts)
            except Exception:
                clean = md_with_ts

            if apply_changes:
                db.update_output_status(script_out["id"], status="completed", progress=100, content=str(clean), error="")
            else:
                logger.info("[dry-run] would update script output (%d chars)", len(str(clean)))

        # Cleanup local temp files
        for p in cleanup_paths:
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass

        logger.info("Done. apply=%s task=%s", apply_changes, task_id)
        return 0

    return asyncio.run(_run())


if __name__ == "__main__":
    raise SystemExit(main())


