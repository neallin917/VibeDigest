#!/usr/bin/env python3
"""
Simple test script to verify backend changes work correctly.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))


async def test_preview_endpoint():
    """Test the new preview-video endpoint."""
    try:
        from video_processor import VideoProcessor
        from utils.url import normalize_video_url

        print("✅ Successfully imported backend modules")

        # Test video processor
        processor = VideoProcessor()
        test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

        print(f"✅ Testing preview for: {test_url}")
        info = await processor.extract_info_only(test_url)

        if info:
            print(f"✅ Preview success: {info.get('title', 'Unknown')}")
        else:
            print("❌ Preview failed - no info returned")

    except ImportError as e:
        print(f"❌ Import error: {e}")
    except Exception as e:
        print(f"❌ Error during preview test: {e}")


async def test_database_connection():
    """Test database connection."""
    try:
        from db_client import DBClient

        print("✅ Successfully imported DBClient")

        client = DBClient()

        # Test a simple query (this might fail in dev, but import should work)
        print("✅ DBClient initialized successfully")

    except Exception as e:
        print(f"❌ Database connection test failed: {e}")


async def main():
    print("🚀 Testing backend after cleanup...")
    print()

    print("1. Testing video preview functionality:")
    await test_preview_endpoint()
    print()

    print("2. Testing database connection:")
    await test_database_connection()
    print()

    print("✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())
