import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.env_loader import load_env
load_env()

from summarizer import Summarizer

async def test_summarizer():
    print("Initializing Summarizer...")
    summarizer = Summarizer()
    print(f"Summarizer initialized. API Key present: {bool(summarizer.api_key)}")
    
    transcript = "This is a short test transcript. It talks about AI and coding. It mentions a key point about refactoring."
    
    print("\nTesting summarize (v2 integration)...")
    try:
        summary = await summarizer.summarize(transcript, target_language="en")
        print("Summary result:", summary[:200] + "..." if len(summary) > 200 else summary)
    except Exception as e:
        print(f"Summary failed: {e}")
        # Don't raise, try others
        
    print("\nTesting classify_content...")
    try:
        classification = await summarizer.classify_content(transcript)
        print("Classification result:", classification)
    except Exception as e:
        print(f"Classification failed: {e}")

    print("\nTesting optimize_transcript...")
    try:
        optimized = await summarizer.optimize_transcript(transcript)
        print("Optimized transcript:", optimized[:200] + "..." if len(optimized) > 200 else optimized)
    except Exception as e:
        print(f"Optimization failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_summarizer())
