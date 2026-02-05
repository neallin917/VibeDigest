#!/usr/bin/env bash
set -euo pipefail

DATASET_PATH="${1:-podcast-dataset.md}"
SOURCES_PATH="${2:-/Users/haoran/.codex/skills/youtube-podcast-tracker/references/sources.json}"
REQ_PATH="/Users/haoran/.codex/skills/youtube-podcast-tracker/references/requirements.txt"

uv venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
uv pip install -r "$REQ_PATH"

python /Users/haoran/.codex/skills/youtube-podcast-tracker/scripts/update_podcast_dataset.py \
  --dataset "$DATASET_PATH" \
  --sources "$SOURCES_PATH"
