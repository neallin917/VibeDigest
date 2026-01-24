import os
import logging
import json
import asyncio
import httpx
from typing import Optional, Tuple, Dict, List

logger = logging.getLogger(__name__)


class SupadataClient:
    """
    Client for Supadata.ai API to fetch YouTube transcripts.
    """

    BASE_URL = "https://api.supadata.ai/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SUPADATA_API_KEY")

    def _get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise ValueError("SUPADATA_API_KEY not found in environment variables.")
        return {"x-api-key": self.api_key, "Content-Type": "application/json"}

    def get_transcript(
        self, video_url: str, lang: str = "en"
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Fetch transcript for a given video URL.

        Args:
            video_url: YouTube video URL.
            lang: Preferred language code (default 'en').
                  Supadata 'auto' mode often works best, but we can pass lang if needed.
                  Actually, Supadata docs say 'text' or 'json' response.
                  We want JSON segments.

        Returns:
            Tuple containing:
            - markdown_text: Formatted markdown string (compatible with our system).
            - raw_json_payload: JSON string of the segments (compatible with our system).
            - detected_language: Language code detected/returned.

            Returns (None, None, None) if supadate fails/unavailable (caller should fallback).
        """
        if not self.api_key:
            logger.warning("Supadata API key not configured. Skipping.")
            return None, None, None

        logger.info(f"Fetching transcript from Supadata for {video_url}")

        try:
            # https://docs.supadata.ai/get-transcript
            # GET /transcript?url=...&text=false
            # Using httpx for sync request (can be async, but for MVP we match current arch if easiest,
            # but main.py uses async pipeline. Let's strictly use sync for now or async?
            # main.py is async. Let's make this async or wrap it?
            # For simplicity in this helper class, let's use httpx.Client (sync) and run in thread if needed
            # OR use httpx.AsyncClient.
            # Since `run_pipeline` in main.py is async, let's use AsyncClient.
            pass
        except Exception:
            pass

        return None, None, None

    async def get_transcript_async(
        self, video_url: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Async version to fetch transcript.
        Uses Langfuse span tracking when available (inherits context from propagate_attributes).
        """
        from contextlib import nullcontext

        # Langfuse V3: Create a span for this external API call
        try:
            from langfuse import get_client

            langfuse = get_client()
            observation_ctx = (
                langfuse.start_as_current_observation(
                    as_type="span",
                    name="Supadata Transcript",
                    input={"video_url": video_url},
                )
                if langfuse
                else nullcontext()
            )
        except ImportError:
            observation_ctx = nullcontext()

        with observation_ctx:
            if not self.api_key:
                logger.warning("Supadata API key not configured. Skipping.")
                return None, None, None

            url = f"{self.BASE_URL}/transcript"
            params = {"url": video_url, "text": "false", "mode": "auto"}

            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    logger.info(f"Calling Supadata API for: {video_url}")
                    resp = await client.get(
                        url, headers=self._get_headers(), params=params
                    )
                    if resp.status_code not in (200, 201, 202):
                        logger.warning(
                            f"Supadata API error {resp.status_code}: {resp.text}"
                        )
                        return None, None, None

                    data = resp.json()
                    logger.info(f"Supadata raw response keys: {list(data.keys())}")

                    # Check if it's a Job ID (async processing) or direct result
                    if "jobId" in data:
                        job_id = data["jobId"]
                        logger.info(f"Supadata returned Job ID {job_id}, polling...")
                        data = await self._poll_job(client, job_id)
                        if not data:
                            return None, None, None

                    # Now we have the result data
                    # Format:
                    # {
                    #   "content": [ { "text": "...", "offset": 123, "duration": 456, "lang": "en" }, ... ],
                    #   "lang": "en",
                    #   "availableLangs": [...]
                    # }

                    content = data.get("content")
                    if not content or not isinstance(content, list):
                        logger.warning(
                            "Supadata returned invalid content format (expected list of segments)."
                        )
                        return None, None, None

                    detected_lang = data.get("lang", "unknown")

                    # Convert to OpenAI-compatible segments
                    openai_segments = []
                    for seg in content:
                        # Supadata: offset (ms), duration (ms)
                        # OpenAI: start (s), end (s)
                        offset_ms = seg.get("offset", 0)
                        duration_ms = seg.get("duration", 0)
                        text = seg.get("text", "")

                        start_s = offset_ms / 1000.0
                        end_s = (offset_ms + duration_ms) / 1000.0

                        openai_segments.append(
                            {"start": start_s, "end": end_s, "text": text}
                        )

                    # Merge small segments into sentence-like chunks
                    # Supadata often returns word-level segments (especially for Chinese), which frontend filters out (<12 chars).
                    merged_segments = []
                    current_chunk = {"start": 0.0, "end": 0.0, "text": ""}
                    current_parts: List[str] = []

                    is_cjk = detected_lang in [
                        "zh",
                        "zh-CN",
                        "zh-TW",
                        "ja",
                        "ja-JP",
                        "ko",
                        "ko-KR",
                        "chinese",
                        "japanese",
                        "korean",
                    ]

                    for i, seg in enumerate(openai_segments):
                        text = seg["text"]
                        start = seg["start"]
                        end = seg["end"]

                        if is_cjk:
                            # For CJK, Supadata/Whisper might output spaces we don't want (e.g. "东 京")
                            text = text.replace(" ", "")

                        if not current_parts:
                            current_chunk["start"] = start

                        current_parts.append(text)
                        current_chunk["end"] = end

                        # Merge conditions:
                        # 1. Ends with punctuation (strongest signal)
                        # 2. Accumulated duration > 5s
                        # 3. Accumulated length > 50 chars

                        # Join strategy matches language
                        join_char = "" if is_cjk else " "
                        # Note: If non-CJK segments already preserve spaces (e.g. "Hello "), joining with " " might double space "Hello  ".
                        # But usually " ".join() is safer for discrete words.
                        # If Supadata gives "Hello " (trailing space), cleaning it to "Hello" and using " ".join is consistent.
                        # Let's strip standard text if we are using " " join.
                        if not is_cjk:
                            current_parts = [
                                p.strip() for p in current_parts
                            ]  # Normalize

                        joined_text = join_char.join(current_parts).strip()
                        duration = end - current_chunk["start"]

                        is_punctuation = (
                            text.strip() and text.strip()[-1] in ".!?。！？"
                        )
                        is_long_duration = duration > 5.0
                        is_long_text = len(joined_text) > 50

                        # Force merge if we have valid content and meet one condition
                        # But also ensure we don't break mid-sentence if possible, unless too long.
                        if (
                            (is_punctuation)
                            or (is_long_duration and len(joined_text) > 20)
                            or (is_long_text)
                        ):
                            merged_segments.append(
                                {
                                    "start": current_chunk["start"],
                                    "end": end,
                                    "text": joined_text,
                                }
                            )
                            current_parts = []
                            current_chunk = {"start": 0.0, "end": 0.0, "text": ""}

                    # Flush remaining
                    if current_parts:
                        join_char = "" if is_cjk else " "
                        if not is_cjk:
                            current_parts = [p.strip() for p in current_parts]
                        merged_segments.append(
                            {
                                "start": current_chunk["start"],
                                "end": current_chunk["end"],
                                "text": join_char.join(current_parts).strip(),
                            }
                        )

                    final_segments = []
                    for s in merged_segments:
                        final_segments.append(
                            {
                                "start": s["start"],
                                "end": s["end"],
                                "duration": s["end"] - s["start"],
                                "text": s["text"],
                            }
                        )

                    raw_payload = {
                        "version": 1,
                        "model": "supadata-auto",
                        "language": detected_lang,
                        "segments": final_segments,
                    }
                    raw_json = json.dumps(raw_payload, ensure_ascii=False)

                    # Generate Markdown (borrow logic from transcriber or reimplement simple one?)
                    # To be DRY, we can Import format_markdown_from_raw_segments from transcriber in main.py.
                    # Here we just return the raw data and let main.py handle formatting using the shared util.
                    # But the signature asks for markdown. Let's do it here or let main do it.
                    # The Plan said: "Returns (markdown, raw_json, detected_language)"
                    # To avoid circular imports or duplication, we can import the helper here.

                    from transcriber import format_markdown_from_raw_segments

                    markdown_text = format_markdown_from_raw_segments(
                        final_segments, detected_language=detected_lang
                    )

                    # Validation: Check for known demo/mock content
                    # Supadata sometimes returns "Adaptive Learning Framework (ALF)" as a placeholder when it fails to fetch real transcript.
                    if (
                        "Adaptive Learning Framework" in markdown_text
                        or "ALF" in markdown_text
                    ):
                        logger.warning(
                            "Supadata returned generic demo/mock content (Adaptive Learning Framework). Treating as failure to force fallback."
                        )
                        return None, None, None

                    # Log content preview for debugging
                    preview = (
                        markdown_text[:200]
                        if len(markdown_text) > 200
                        else markdown_text
                    )
                    logger.info(
                        f"Supadata transcript preview ({len(final_segments)} segments, lang={detected_lang}): {preview}"
                    )

                    return markdown_text, raw_json, detected_lang

                except Exception as e:
                    logger.error(f"Supadata request failed: {e}")
                    return None, None, None

    async def _poll_job(
        self, client: httpx.AsyncClient, job_id: str, max_retries: int = 150
    ) -> Optional[Dict]:
        """
        Poll job status. Default 150 * 2s = 5 minutes timeout.
        """
        url = f"{self.BASE_URL}/transcript/{job_id}"

        for i in range(max_retries):
            try:
                await asyncio.sleep(2)  # Wait 2s
                resp = await client.get(url, headers=self._get_headers())
                if resp.status_code != 200:
                    logger.warning(f"Poll check {i} failed: {resp.status_code}")
                    continue

                data = resp.json()
                status = data.get("status")

                if status == "completed":
                    return data
                elif status == "failed":
                    logger.error(f"Supadata job {job_id} failed: {data.get('error')}")
                    return None
                else:
                    if i % 5 == 0:
                        logger.info(
                            f"Job {job_id} status: {status} (attempt {i}/{max_retries})"
                        )

                # Continue polling
            except Exception as e:
                logger.warning(f"Polling error: {e}")

        logger.warning(
            f"Supadata job {job_id} timed out after {max_retries * 2} seconds."
        )
        return None
