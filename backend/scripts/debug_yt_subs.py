
import yt_dlp
import sys

url = "https://www.youtube.com/watch?v=tkw6gx1bprY"

ydl_opts = {
    'list_subs': True,
    'writeautomaticsub': True,
    'subtitleslangs': ['all'],
    'skip_download': True,
    'quiet': False, # Detailed output
    'no_warnings': False
}

print(f"Checking subtitles for: {url}")

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    try:
        ydl.extract_info(url, download=False)
    except Exception as e:
        print(f"Error: {e}")
