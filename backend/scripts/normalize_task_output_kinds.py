import argparse
from typing import Dict, List

from db_client import DBClient


def normalize_kind(kind: str) -> str:
    if not kind:
        return kind
    if kind.startswith("OutputKind."):
        return kind.split(".", 1)[1].lower()
    return kind


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize task_outputs.kind values like 'OutputKind.SCRIPT' -> 'script'."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates to the database (default: dry-run).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of rows processed.",
    )
    args = parser.parse_args()

    db = DBClient()
    query = "SELECT id, task_id, kind FROM task_outputs WHERE kind LIKE 'OutputKind.%'"
    if args.limit:
        query += " LIMIT :limit"
        rows = db._execute_query(query, {"limit": args.limit})
    else:
        rows = db._execute_query(query)

    if not rows:
        print("No task_outputs rows found with kind starting with 'OutputKind.'.")
        return

    updates: List[Dict[str, str]] = []
    for row in rows:
        old_kind = row.get("kind")
        new_kind = normalize_kind(old_kind)
        if new_kind and new_kind != old_kind:
            updates.append({"id": row["id"], "old": old_kind, "new": new_kind})

    print(f"Found {len(updates)} rows to normalize (out of {len(rows)} scanned).")
    for item in updates[:10]:
        print(f"- {item['id']}: {item['old']} -> {item['new']}")
    if len(updates) > 10:
        print(f"... {len(updates) - 10} more")

    if not args.apply:
        print("Dry-run only. Re-run with --apply to write changes.")
        return

    for item in updates:
        db._execute_query(
            "UPDATE task_outputs SET kind = :kind, updated_at = now() WHERE id = :id",
            {"kind": item["new"], "id": item["id"]},
        )

    print("Done. Normalization applied.")


if __name__ == "__main__":
    main()
