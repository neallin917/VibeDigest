"""
One-off backfill script:
- Find existing tasks whose video_url is xiaoyuzhoufm.com
- If task_outputs has no 'audio' kind yet, create it
- Extract a direct audio URL via yt-dlp (no download, no transcription)
- Save the URL into task_outputs.content

Run with uv (required by repo convention):
  uv run scripts/backfill_xiaoyuzhou_audio.py --dry-run --limit 20
  uv run scripts/backfill_xiaoyuzhou_audio.py --limit 200
"""

import argparse
import logging
import sys
from pathlib import Path
import json
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

import yt_dlp
from dotenv import load_dotenv

# Ensure repo root is on sys.path so we can import backend modules when running as a script.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Load backend env (SUPABASE_URL / SUPABASE_SERVICE_KEY)
load_dotenv(REPO_ROOT / "backend" / ".env", override=False)

from backend.db_client import DBClient  # noqa: E402


logger = logging.getLogger("backfill_xiaoyuzhou_audio")


def setup_logging(debug: bool) -> None:
    level = logging.DEBUG if debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )


def is_xiaoyuzhou_url(url: str) -> bool:
    try:
        host = (urlparse(url).hostname or "").replace("www.", "")
        return host.endswith("xiaoyuzhoufm.com")
    except Exception:
        return False


def fetch_og_image(page_url: str, timeout_seconds: float = 8.0) -> Optional[str]:
    try:
        req = Request(
            page_url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; VibeDigest/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
            method="GET",
        )
        with urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read(1024 * 1024)
        html = raw.decode("utf-8", errors="ignore")

        m = re.search(
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            html,
            flags=re.IGNORECASE,
        )
        if m:
            return m.group(1).strip()
        m = re.search(
            r'<meta[^>]+name=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            html,
            flags=re.IGNORECASE,
        )
        if m:
            return m.group(1).strip()
        return None
    except (HTTPError, URLError, TimeoutError):
        return None
    except Exception:
        return None


def fetch_xiaoyuzhou_episode_cover(page_url: str, timeout_seconds: float = 8.0) -> Optional[str]:
    try:
        req = Request(
            page_url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; VibeDigest/1.0)",
                "Accept": "text/html,application/xhtml+xml",
            },
            method="GET",
        )
        with urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read(1024 * 1024)
        html = raw.decode("utf-8", errors="ignore")
        m = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if not m:
            return None
        data = json.loads(m.group(1))
        episode = ((data.get("props") or {}).get("pageProps", {}) or {}).get("episode", {}) or {}
        image = (episode.get("image") or {}) if isinstance(episode, dict) else {}
        for k in ("largePicUrl", "middlePicUrl", "smallPicUrl", "picUrl", "thumbnailUrl"):
            v = image.get(k)
            if isinstance(v, str) and v:
                return v
        return None
    except Exception:
        return None


def extract_direct_audio_url(info: dict) -> Optional[str]:
    """
    Best-effort: extract a direct audio URL from yt-dlp info dict.
    NOTE: This URL may expire for some providers; for xiaoyuzhou it's usually usable.
    """
    if not info:
        return None

    # Playlist / wrapper
    if isinstance(info.get("entries"), list) and info["entries"]:
        first = info["entries"][0]
        if isinstance(first, dict):
            info = first

    formats = info.get("formats") or []
    audio_formats: List[dict] = []
    for f in formats:
        if not isinstance(f, dict):
            continue
        url = f.get("url")
        if not url:
            continue
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        if vcodec == "none" and acodec and acodec != "none":
            audio_formats.append(f)

    def score(f: dict) -> float:
        for k in ("abr", "tbr", "asr"):
            v = f.get(k)
            try:
                if v is not None:
                    return float(v)
            except Exception:
                continue
        return 0.0

    if audio_formats:
        best = sorted(audio_formats, key=score, reverse=True)[0]
        return best.get("url")

    url = info.get("url")
    if isinstance(url, str) and url:
        return url
    return None


def yt_dlp_extract(url: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract (direct_audio_url, title, thumbnail) without downloading.
    """
    ydl_opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "skip_download": True,
        # Prefer audio-only when formats are available
        "format": "bestaudio/best",
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        direct = extract_direct_audio_url(info)
        title = info.get("title") if isinstance(info, dict) else None
        thumbnail = info.get("thumbnail") if isinstance(info, dict) else None
        if is_xiaoyuzhou_url(url):
            cover = fetch_xiaoyuzhou_episode_cover(url) or fetch_og_image(url)
            if cover:
                thumbnail = cover
        return direct, title, thumbnail


def fetch_tasks(db: DBClient, status_filter: str, limit: int, offset: int) -> List[Dict[str, Any]]:
    if not db.supabase:
        raise RuntimeError("Supabase client not initialized (missing SUPABASE_URL/SUPABASE_SERVICE_KEY).")

    q = (
        db.supabase.table("tasks")
        .select("id,user_id,video_url,status,thumbnail_url")
        .ilike("video_url", "%xiaoyuzhoufm.com%")
        .range(offset, offset + limit - 1)
    )
    if status_filter != "all":
        q = q.eq("status", status_filter)

    resp = q.execute()
    return resp.data or []


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill audio outputs for xiaoyuzhoufm tasks.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to Supabase, only log actions.")
    parser.add_argument("--limit", type=int, default=200, help="Max tasks to scan per run.")
    parser.add_argument("--offset", type=int, default=0, help="Offset for pagination.")
    parser.add_argument(
        "--status",
        choices=["all", "completed", "processing", "pending", "error", "failed"],
        default="completed",
        help="Only scan tasks with this status (default: completed). Use all to scan everything.",
    )
    parser.add_argument("--debug", action="store_true", help="Verbose logging.")
    args = parser.parse_args()

    setup_logging(args.debug)

    db = DBClient()
    if not db.supabase:
        logger.error("Supabase client not available. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.")
        return 2

    tasks = fetch_tasks(db, status_filter=args.status, limit=args.limit, offset=args.offset)
    logger.info("Fetched %d candidate tasks (status=%s, offset=%d, limit=%d).", len(tasks), args.status, args.offset, args.limit)

    updated = 0
    skipped = 0
    failed = 0

    for t in tasks:
        task_id = t.get("id")
        video_url = t.get("video_url") or ""
        user_id = t.get("user_id")
        existing_thumb = t.get("thumbnail_url")

        if not task_id or not user_id or not video_url:
            skipped += 1
            continue

        if not is_xiaoyuzhou_url(video_url):
            skipped += 1
            continue

        outputs = db.get_task_outputs(task_id)
        existing_audio = next((o for o in outputs if o.get("kind") == "audio"), None)

        logger.info("Backfilling task=%s url=%s", task_id, video_url)

        if args.dry_run:
            direct, title, thumb = yt_dlp_extract(video_url)
            logger.info(
                "[dry-run] would ensure audio output and episode cover. extracted direct=%s title=%s cover=%s",
                bool(direct),
                title,
                bool(thumb),
            )
            updated += 1
            continue

        # 1) Create audio output (if missing)
        audio_out_id = existing_audio.get("id") if existing_audio else None
        if not audio_out_id:
            try:
                audio_out = db.create_task_output(task_id, user_id, kind="audio")
            except Exception as e:
                logger.error("Failed creating audio output for task=%s: %s", task_id, e)
                failed += 1
                continue
            audio_out_id = audio_out.get("id")
        if not audio_out_id:
            logger.error("Created audio output missing id for task=%s", task_id)
            failed += 1
            continue

        # 2) Extract direct url
        try:
            db.update_output_status(audio_out_id, status="processing", progress=10)
            direct, title, thumb = yt_dlp_extract(video_url)
            if direct:
                payload = {"audioUrl": direct, "coverUrl": thumb}
                db.update_output_status(
                    audio_out_id,
                    status="completed",
                    progress=100,
                    content=json.dumps(payload, ensure_ascii=False),
                )

                # Also update tasks.thumbnail_url so History page uses episode cover
                if thumb and thumb != existing_thumb:
                    try:
                        db.supabase.table("tasks").update({"thumbnail_url": thumb}).eq("id", task_id).execute()
                    except Exception as e:
                        logger.warning("Failed updating tasks.thumbnail_url for task=%s: %s", task_id, e)

                updated += 1
            else:
                db.update_output_status(audio_out_id, status="error", error="No direct audio URL available")
                failed += 1
                logger.warning("No direct audio URL for task=%s", task_id)
        except Exception as e:
            failed += 1
            logger.error("Extraction failed for task=%s: %s", task_id, e)
            try:
                db.update_output_status(audio_out_id, status="error", error=str(e))
            except Exception:
                pass

    logger.info("Done. updated=%d skipped=%d failed=%d dry_run=%s", updated, skipped, failed, args.dry_run)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())


