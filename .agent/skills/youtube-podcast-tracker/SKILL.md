---
name: youtube-podcast-tracker
description: "Track new episodes from specific YouTube podcast channels or playlists using yt-dlp and append fresh metadata into a local Markdown dataset. Use when asked to refresh a podcast dataset, find new uploads from given channels/playlists, or maintain a daily podcast metadata table (title/url/channel/published_at/views/likes/comments/duration)."
---

# YouTube Podcast Tracker

## Workflow

1. Read `references/sources.json` for the target podcast channels/playlists.
2. Create a uv venv and install pinned dependencies from `references/requirements.txt` (or `references/uv.lock`).
3. Run the updater script to fetch only **new** items and append them to the dataset.
4. Confirm the dataset file has the expected columns and newest rows are at the top.

## Commands (uv recommended)

### One-shot bootstrap (recommended)

```bash
/Users/haoran/.codex/skills/youtube-podcast-tracker/scripts/bootstrap_uv.sh podcast-dataset.md
```

### Manual

```bash
uv venv .venv
source .venv/bin/activate
uv pip install -r /Users/haoran/.codex/skills/youtube-podcast-tracker/references/requirements.txt

python /Users/haoran/.codex/skills/youtube-podcast-tracker/scripts/update_podcast_dataset.py \
  --dataset podcast-dataset.md \
  --sources /Users/haoran/.codex/skills/youtube-podcast-tracker/references/sources.json
```

Optional flags:

- `--max-per-source N` limit per channel/playlist
- `--since-days N` only consider uploads in last N days

## Output format (Markdown table)

Columns (fixed order):

`title | url | channel | published_at | views | likes | comments | duration`

## Notes

- Requires `yt-dlp` on PATH (installed in the uv venv).
- Uses incremental updates: existing URLs in the dataset will not be re-fetched.
- If `podcast-dataset.md` does not exist, it will be created with a header.

