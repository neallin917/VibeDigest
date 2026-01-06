import sys
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Setup path
sys.path.append(str(Path(__file__).parent.parent))
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from supadata_client import SupadataClient

async def test_supadata():
    client = SupadataClient()
    print(f"Testing Supadata API with key: {client.api_key[:5]}... if present")
    
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
