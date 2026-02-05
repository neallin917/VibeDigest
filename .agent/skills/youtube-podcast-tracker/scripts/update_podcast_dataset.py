#!/usr/bin/env python3
"""Update a Markdown dataset with new YouTube podcast uploads using yt-dlp."""

import argparse
import datetime as dt
import json
import os
import re
import random
import subprocess
import sys
import time
from typing import Dict, List, Optional, Tuple

HEADER = "| Import Status | Crawled At | Thumbnail | Title | URL | Channel | Published At | Views | Likes | Comments | Duration | Tags | Description |"
SEPARATOR = "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"


def run_cmd_json(args: List[str]) -> Dict:
    cmd = ["yt-dlp"] + args
    try:
        out = subprocess.check_output(cmd)
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(f"yt-dlp failed: {exc}\n")
        raise
    return json.loads(out)


def load_sources(path: str) -> List[Dict[str, str]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_existing_dataset(path: str) -> Tuple[List[str], List[str], set]:
    if not os.path.exists(path):
        return [], [], set()

    with open(path, "r", encoding="utf-8") as f:
        lines = [line.rstrip("\n") for line in f]

    if not lines:
        return [], [], set()

    header_idx = None
    for i, line in enumerate(lines):
        if line.strip().lower() == HEADER:
            header_idx = i
            break

    if header_idx is None:
        # Treat entire file as body if header not found
        return [], lines, set()

    header_line = lines[header_idx]
    header_cells = [c.strip().lower() for c in header_line.strip("|").split("|")]
    
    try:
        url_idx = header_cells.index("url")
    except ValueError:
        # Fallback if "url" column not found
        return [], lines, set()

    body = lines[header_idx + 2 :]
    url_set = set()
    for line in body:
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) <= url_idx:
            continue
        url = cells[url_idx]
        if url:
            url_set.add(url)

    return lines[: header_idx + 2], body, url_set


def format_date(upload_date: Optional[str]) -> str:
    if not upload_date:
        return ""
    try:
        return dt.datetime.strptime(upload_date, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return upload_date


def format_int(value: Optional[int]) -> str:
    if value is None:
        return ""
    try:
        return f"{int(value):,}"
    except (ValueError, TypeError):
        return ""


def format_duration(seconds: Optional[int]) -> str:
    if seconds is None:
        return ""
    try:
        seconds = int(seconds)
    except (ValueError, TypeError):
        return ""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def escape_cell(text: str) -> str:
    if not text:
        return ""
    # Remove newlines for table compatibility
    text = text.replace("\n", " ").replace("\r", "")
    return text.replace("|", "\\|")


def truncate_text(text: str, length: int = 100) -> str:
    if not text:
        return ""
    if len(text) <= length:
        return text
    return text[:length].strip() + "..."


def video_url_from_entry(entry: Dict) -> Optional[str]:
    if entry.get("webpage_url"):
        return entry["webpage_url"]
    if entry.get("url"):
        if entry["url"].startswith("http"):
            return entry["url"]
        if entry["url"].startswith("/watch"):
            return "https://www.youtube.com" + entry["url"]
    vid = entry.get("id")
    if vid:
        return f"https://www.youtube.com/watch?v={vid}"
    return None


def list_source_entries(source_url: str, limit: int = 0, since_days: int = 0) -> List[Dict]:
    args = ["--flat-playlist", "-J", source_url]
    
    if limit > 0:
        args.extend(["--playlist-end", str(limit)])
        
    if since_days > 0:
        # Optimization: Tell yt-dlp to stop scanning once it hits videos older than N days
        # This prevents paging through the entire channel history
        date_cutoff = (dt.date.today() - dt.timedelta(days=since_days)).strftime("%Y%m%d")
        args.extend([
            "--dateafter", date_cutoff,
            "--break-on-reject"  # Critical: Stop fetching once a video doesn't match dateafter
        ])

    data = run_cmd_json(args)
    return data.get("entries", [])


def fetch_video_details(video_url: str) -> Dict:
    return run_cmd_json(["-J", "--skip-download", video_url])


def within_since_days(upload_date: Optional[str], since_days: Optional[int]) -> bool:
    if not since_days or not upload_date:
        return True
    try:
        dt_upload = dt.datetime.strptime(upload_date, "%Y%m%d").date()
    except ValueError:
        return True
    cutoff = dt.date.today() - dt.timedelta(days=since_days)
    return dt_upload >= cutoff


def build_row(details: Dict) -> str:
    # Note: When using --lite (flat-playlist), some keys might vary or be missing
    title = escape_cell(details.get("title") or "")
    url = details.get("webpage_url") or details.get("url") or ""
    # flat-playlist often uses 'uploader' instead of 'channel'
    channel = escape_cell(details.get("channel") or details.get("uploader") or "")
    published_at = format_date(details.get("upload_date"))
    
    # These stats are usually 0 or None in lite mode
    views = format_int(details.get("view_count"))
    likes = format_int(details.get("like_count"))
    comments = format_int(details.get("comment_count"))
    
    duration = format_duration(details.get("duration"))

    # Metadata columns
    thumbnail_url = details.get("thumbnail") or ""
    thumbnails_list = details.get("thumbnails")
    if not thumbnail_url and thumbnails_list and isinstance(thumbnails_list, list):
         # Try to find the best thumbnail (last one usually highest res)
         if thumbnails_list:
              thumbnail_url = thumbnails_list[-1].get("url", "")

    # In flat mode, thumbnails might be a list directly in 'thumbnail' sometimes?
    if isinstance(thumbnail_url, list) and thumbnail_url:
        thumbnail_url = thumbnail_url[0].get("url", "")
        
    if thumbnail_url:
        thumbnail = f"![]({thumbnail_url})"
    else:
        thumbnail = ""
    
    tags_list = details.get("tags") or []
    tags = escape_cell(", ".join(tags_list[:5])) # Limit to 5 tags
    
    original_desc = details.get("description") or ""
    description = escape_cell(truncate_text(original_desc, 200))

    # Tracking columns
    crawled_at = dt.datetime.now().strftime("%Y-%m-%d")
    import_status = "未导入"

    return (
        f"| {import_status} | {crawled_at} | {thumbnail} | {title} | {url} | {channel} | {published_at} | {views} | {likes} | {comments} | {duration} | {tags} | {description} |"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="podcast-dataset.md")
    parser.add_argument(
        "--sources",
        default=os.path.join(
            os.path.dirname(__file__), "..", "references", "sources.json"
        ),
    )
    parser.add_argument("--max-per-source", type=int, default=5)
    parser.add_argument("--since-days", type=int, default=14)
    parser.add_argument("--min-duration-minutes", type=int, default=15)
    parser.add_argument("--lite", action="store_true", default=False, help="Skip detailed metadata fetching (views, likes, desc) to avoid rate limits")
    args = parser.parse_args()

    sources_path = os.path.abspath(args.sources)
    dataset_path = os.path.abspath(args.dataset)

    header_lines, body_lines, existing_urls = parse_existing_dataset(dataset_path)

    if not header_lines:
        header_lines = [HEADER, SEPARATOR]
        body_lines = []

    sources = load_sources(sources_path)

    new_rows: List[str] = []
    for i, source in enumerate(sources):
        if i > 0:
             # Random sleep between sources to be polite
             # Increased to 5-10s to be safer
             sleep_time = random.uniform(5.0, 10.0)
             print(f"Sleeping {sleep_time:.1f}s...")
             time.sleep(sleep_time)

        entries = list_source_entries(
            source["url"], 
            limit=args.max_per_source, 
            since_days=args.since_days
        )
        # Slicing is still good practice even with playlist-end, to be sure
        if args.max_per_source:
             entries = entries[: args.max_per_source]

        # Flatten entries if they are playlists (e.g. channel tabs)
        flattened_entries = []
        for e in entries:
            if e.get("_type") == "playlist" and "entries" in e:
                # Propagate channel name from parent if missing in child
                parent_channel = e.get("channel") or e.get("uploader") or source["name"]
                for child in e["entries"]:
                    if not child.get("channel") and not child.get("uploader"):
                        child["channel"] = parent_channel
                flattened_entries.extend(e["entries"])
            else:
                 # Ensure channel name fallback
                if not e.get("channel") and not e.get("uploader"):
                    e["channel"] = source["name"]
                flattened_entries.append(e)
        entries = flattened_entries

        for entry in entries:
            video_url = video_url_from_entry(entry)
            if not video_url or video_url in existing_urls:
                continue
            upload_date = entry.get("upload_date")
            if not within_since_days(upload_date, args.since_days or None):
                 continue
            
            # Filter by duration if requested (duration is in seconds)
            if args.min_duration_minutes > 0:
                duration = entry.get("duration")
                if duration is not None and duration < (args.min_duration_minutes * 60):
                    continue

            if args.lite:
                # In lite mode, use the entry data directly. 
                # Note: flat-playlist entries might miss views/likes/tags/desc.
                details = entry
                # Map flat-playlist keys to full details keys if necessary
                if "upload_date" not in details:
                    # sometimes it's missing in flat result
                    pass 
            else:
                try:
                    details = fetch_video_details(video_url)
                    # Use fallback if detailed fetch missed channel
                    if not details.get("channel") and not details.get("uploader"):
                         details["channel"] = entry.get("channel") or source["name"]
                except Exception as e:
                    print(f"Error fetching details for {video_url}: {e}")
                    # Fallback to entry basics if detailed fetch fails, or skip? 
                    # Let's use entry but mark as fallback
                    details = entry

                # Increased sleep between video detail fetches
                time.sleep(random.uniform(3.0, 6.0))

            row = build_row(details)
            new_rows.append(row)

    # Sort new rows by published_at (desc) if possible
    def sort_key(row: str) -> str:
        cells = [c.strip() for c in row.strip("|").split("|")]
        if len(cells) >= 4:
            return cells[3]
        return ""

    new_rows.sort(key=sort_key, reverse=True)

    output_lines = header_lines + new_rows + body_lines
    with open(dataset_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines).rstrip() + "\n")

    print(f"Added {len(new_rows)} new rows to {dataset_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

