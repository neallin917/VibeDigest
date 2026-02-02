import asyncio
import os
import sys

# Add /app to sys.path just in case, though it should be cwd
sys.path.append('/app')

from services.video_processor import VideoProcessor

async def main():
    url = "https://www.youtube.com/watch?v=ExNWGF-q64M"
    
    print(f"Testing URL inside Docker: {url}")
    
    processor = VideoProcessor()
    
    try:
        print("\n--- Testing Metadata Extraction ---")
        # specific header check
        print(f"Proxy env: {os.getenv('YTDLP_PROXY')}")
        
        info = await processor.extract_info_only(url)
        print("Metadata extraction successful!")
        print(f"Title: {info.get('title')}")
        
    except Exception as e:
        print(f"\nError occurred: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
