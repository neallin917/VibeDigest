import argparse
import json
from typing import Any, Dict, Optional

from db_client import DBClient


def _try_parse_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    raw = text.strip()
    if not raw:
        return None
    try:
        val = json.loads(raw)
    except Exception:
        return None
    if isinstance(val, str):
        try:
            val = json.loads(val)
        except Exception:
            return None
    if isinstance(val, dict):
        return val
    return None


def _looks_like_fallback(payload: Dict[str, Any]) -> bool:
    overview = payload.get("overview")
    keypoints = payload.get("keypoints")
    if not isinstance(overview, str) or not isinstance(keypoints, list):
        return False

    overview_len = len(overview.strip())
    if overview_len < 600:
        return False

    details = []
    evidence_missing = 0
    for kp in keypoints:
        if not isinstance(kp, dict):
            continue
        detail = str(kp.get("detail") or "")
        if detail:
            details.append(len(detail.strip()))
        evidence = str(kp.get("evidence") or "").strip()
        if not evidence:
            evidence_missing += 1

    if not details:
        return False

    avg_detail = sum(details) / len(details)
    # Heuristic: very long overview + long keypoint details + no evidence
    if overview_len >= 800 and avg_detail >= 180 and evidence_missing >= max(3, len(keypoints) // 2):
        return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Clean up fallback summary_source outputs")
    parser.add_argument("--apply", action="store_true", help="Apply changes to DB (default: dry-run)")
    parser.add_argument("--limit", type=int, default=200, help="Max rows to scan per run")
    args = parser.parse_args()

    db = DBClient()
    rows = db._execute_query(
        """
        SELECT id, content, status
        FROM task_outputs
        WHERE kind = 'summary_source'
        ORDER BY updated_at DESC
        LIMIT :limit
        """,
        {"limit": args.limit},
    )

    flagged = 0
    for row in rows:
        content = row.get("content") or ""
        payload = _try_parse_json(content)
        if not payload:
            continue
        if not _looks_like_fallback(payload):
            continue

        flagged += 1
        output_id = row["id"]
        if args.apply:
            db.update_output_status(
                output_id,
                status="error",
                progress=100,
                content="",
                error="Summary fallback detected; please retry summary.",
            )
        else:
            print(f"[dry-run] flag output {output_id}")

    print(f"Flagged {flagged} summary_source outputs")


if __name__ == "__main__":
    main()
