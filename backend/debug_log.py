
import os
import json
import re
from db_client import DBClient
from dotenv import load_dotenv

load_dotenv()

def _is_cjk_text(text: str) -> bool:
    if not text:
        return False
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)

def _normalize_for_match(text: str) -> str:
    s = (text or "").lower()
    s = re.sub(r"[^\w\u4e00-\u9fff]+", " ", s, flags=re.UNICODE)
    return re.sub(r"\s+", " ", s).strip()

def _tokenize_for_match(text: str) -> set[str]:
    s = _normalize_for_match(text)
    if not s:
        return set()
    if _is_cjk_text(s):
        compact = s.replace(" ", "")
        if len(compact) <= 1:
            return {compact} if compact else set()
        return {compact[i : i + 2] for i in range(len(compact) - 1)}
    return {t for t in s.split(" ") if len(t) >= 2}

def _score_segment_match(*, query: str, query_tokens: set[str], seg_text: str, seg_tokens: set[str]) -> float:
    if not seg_text:
        return 0.0
    qn = _normalize_for_match(query)
    sn = _normalize_for_match(seg_text)
    if not qn or not sn:
        return 0.0
    score = 0.0
    if len(qn) >= 8 and qn in sn:
        score += 30.0
    if query_tokens and seg_tokens:
        inter = len(query_tokens & seg_tokens)
        score += 12.0 * (inter / max(1, len(query_tokens)))
        score += min(8.0, float(inter))
    score -= min(3.0, len(sn) / 280.0)
    return score

def _build_keypoint_query(kp: dict) -> str:
    if not isinstance(kp, dict):
        return ""
    title = str(kp.get("title", "") or "").strip()
    detail = str(kp.get("detail", "") or "").strip()
    evidence = str(kp.get("evidence", "") or "").strip()
    parts = []
    if evidence:
        parts.append(evidence)
    if title:
        parts.append(title)
    if detail:
        parts.append(detail[:220])
    return " ".join([p for p in parts if p]).strip()

def inspect_task(task_id):
    db = DBClient()
    print(f"Inspecting task: {task_id}")
    
    outputs = db.get_task_outputs(task_id)
    if not outputs:
        print("No outputs found.")
        return

    # Iterate over summary and summary_source outputs
    summary_outputs = [o for o in outputs if o['kind'] in ('summary', 'summary_source')]
    print(f"Found {len(summary_outputs)} summary/source outputs.")
    
    for o in summary_outputs:
        print(f"Output ID: {o['id']}, Kind: {o['kind']}, Locale: {o.get('locale')}")


            
    return

    # Parse script segments once
    try:
        raw_payload = json.loads(script_raw_out['content'])
        segments = raw_payload.get("segments", [])
        simple_segs = []
        for s in segments:
            simple_segs.append({
                "start": float(s.get("start", 0)),
                "end": float(s.get("end", 0)),
                "text": s.get("text", "")
            })
        print(f"Loaded {len(simple_segs)} segments from script_raw (lang={raw_payload.get('language')}).")
    except Exception as e:
        print(f"Error parsing script: {e}")
        return

    # Precompute segment tokens
    seg_cache = []
    for s in simple_segs:
        seg_cache.append((s, _tokenize_for_match(s["text"])))

    for idx, sum_out in enumerate(summary_outputs):
        print(f"\n--- Summary Output #{idx+1} (locale={sum_out.get('locale')}) ---")
        try:
            sum_payload = json.loads(sum_out['content'])
            keypoints = sum_payload.get("keypoints", [])
            print(f"Language: {sum_payload.get('language')}")
        except Exception as e:
            print(f"Error parsing summary content: {e}")
            continue

        print(f"Analyzing {len(keypoints)} keypoints...")
        
        for i, kp in enumerate(keypoints):
            query = _build_keypoint_query(kp)
            q_tokens = _tokenize_for_match(query)
            
            best_score = -1e9
            best_seg = None
            
            for seg, seg_tokens in seg_cache:
                sc = _score_segment_match(query=query, query_tokens=q_tokens, seg_text=seg["text"], seg_tokens=seg_tokens)
                if sc > best_score:
                    best_score = sc
                    best_seg = seg
            
            has_timestamp = "startSeconds" in kp
            status = "HAS_TIME" if has_timestamp else "NO_TIME"
            print(f"KP #{i+1} [{status}]: {kp.get('title')[:20]}...")
            print(f"  Query: {query[:40]}...")
            print(f"  Best Score: {best_score:.2f} (Threshold: 6.0)")
            if best_seg:
                print(f"  Best Match: [{best_seg['start']:.1f}-{best_seg['end']:.1f}] {best_seg['text'][:30]}...")

if __name__ == "__main__":
    # Example usage: python3 backend/debug_log.py [task_id]
    import sys
    if len(sys.argv) > 1:
        inspect_task(sys.argv[1])
    else:
        print("Usage: python3 backend/debug_log.py <task_id>")
