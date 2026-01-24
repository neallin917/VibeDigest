from urllib.parse import urlparse, urlunparse, parse_qs, urlencode


def normalize_video_url(url: str) -> str:
    """
    Normalize a video URL to improve cache hit rates.
    - Adds scheme if missing.
    - Standardizes YouTube URLs to https://youtube.com/watch?v=...
    - Removes common tracking parameters (utm_*, ref, etc.)
    - Removes fragments.
    """
    if not url:
        return ""

    url = url.strip()

    # Defensive: Filter out Javascript string literals "undefined", "null"
    if url.lower() in ("undefined", "null", "none"):
        return ""

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    try:
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        netloc = parsed.netloc.lower()
        path = parsed.path
        query = parse_qs(parsed.query)

        # Remove 'www.' prefix for consistency (except maybe for some sites? but usually safe)
        if netloc.startswith("www."):
            netloc = netloc[4:]

        # Handle YouTube specific normalization
        if "youtube.com" in netloc or "youtu.be" in netloc:
            video_id = None
            if "youtu.be" in netloc:
                # https://youtu.be/VIDEO_ID
                parts = path.split("/")
                if len(parts) > 1:
                    video_id = parts[1]
            elif "youtube.com" in netloc:
                # https://youtube.com/watch?v=VIDEO_ID
                # https://youtube.com/shorts/VIDEO_ID
                if "/shorts/" in path:
                    parts = path.split("/shorts/")
                    if len(parts) > 1:
                        video_id = parts[1].split("/")[0]  # handle trailing slashes
                elif "v" in query:
                    video_id = query["v"][0]

            if video_id:
                # Return canonical YouTube URL
                # We discard timestamps (t=...) for caching purposes?
                # Ideally yes, we want to cache the whole video processing.
                return f"https://youtube.com/watch?v={video_id}"

        # General Parameter Cleanup
        # Remove tracking parameters
        blocked_params = {
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "ref",
            "source",
            "from",
        }

        # Rebuild query keeping only non-blocked
        new_query_parts = []
        for key, values in query.items():
            if key.lower() not in blocked_params:
                for v in values:
                    new_query_parts.append((key, v))

        # Sort for determinism
        new_query_parts.sort()
        new_query_string = urlencode(new_query_parts)

        # Bilibili specific: normalize to https://bilibili.com/video/BV...
        if "bilibili.com" in netloc:
            # Check for /video/BV...
            # We preserve 'p' (page) if present, as it changes the content.
            pass

        return urlunparse((scheme, netloc, path, None, new_query_string, None))

    except Exception:
        # Fallback to original if parsing fails
        return url
