
import sys
import os

# Add backend directory to path so we can import the module
sys.path.append(os.path.abspath("backend"))

try:
    from utils.url import normalize_video_url
except ImportError:
    # Fallback if run from root
    sys.path.append(os.path.abspath("."))
    from backend.utils.url import normalize_video_url

def test_url(url, description):
    print(f"Testing {description}: {url}")
    try:
        normalized = normalize_video_url(url)
        if normalized:
            print(f"  ✅ Pass: {normalized}")
            return True
        else:
            print(f"  ❌ Fail: Returned empty string")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    urls_to_test = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "Standard"),
        ("https://youtu.be/dQw4w9WgXcQ", "Short link"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "Shorts"),
        ("https://www.youtube.com/live/dQw4w9WgXcQ", "Live stream"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ", "Mobile"),
        ("https://music.youtube.com/watch?v=dQw4w9WgXcQ", "Music"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "With Timestamp"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "Embed"),
        ("https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ", "Feature param first"),
    ]

    failed = 0
    for url, desc in urls_to_test:
        if not test_url(url, desc):
            failed += 1

    if failed > 0:
        print(f"\n{failed} tests failed.")
        sys.exit(1)
    else:
        print("\nAll tests passed!")

if __name__ == "__main__":
    main()
