import sys
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
import pytest

# Setup path
sys.path.append(str(Path(__file__).parent.parent))
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from supadata_client import SupadataClient

@pytest.mark.skipif(
    not os.getenv("SUPADATA_API_KEY"),
    reason="SUPADATA_API_KEY not set - skipping external API test"
)
async def test_supadata():
    client = SupadataClient()
    api_key_preview = client.api_key[:5] if client.api_key else "NOT SET"
    print(f"Testing Supadata API with key: {api_key_preview}...")
    
    url = "https://youtube.com/watch?v=lAy9RKQSi2U"
    print(f"Fetching transcript for: {url}")
    
    md, raw, lang = await client.get_transcript_async(url)
    
    if not md:
        print("Failed to get transcript.")
        return

    print(f"Detected Lang: {lang}")
    print(f"Markdown Content Preview (first 500 chars):\n")
    print(md[:500])
    
    if "Adaptive Learning Framework" in md:
        print("\n!!! DETECTED 'Adaptive Learning Framework' in output !!!")
        print("Confirmation: The external API is receiving/returning this text.")
    else:
        print("\nDid NOT find 'Adaptive Learning Framework' in output.")

if __name__ == "__main__":
    asyncio.run(test_supadata())
