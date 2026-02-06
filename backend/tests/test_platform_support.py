import pytest
from unittest.mock import patch, MagicMock
from services.video_processor import VideoProcessor


@pytest.fixture
def processor():
    return VideoProcessor()


@pytest.mark.asyncio
async def test_enrich_xiaoyuzhou(processor):
    """Test metadata enrichment for Xiaoyuzhou URL."""
    info = {"title": "Original Title"}
    url = "https://www.xiaoyuzhoufm.com/episode/123"

    with patch.object(processor, "_fetch_xiaoyuzhou_metadata") as mock_fetch:
        mock_fetch.return_value = {
            "author": "Podcast Author",
            "author_image": "http://img.com/author.jpg",
            "thumbnail": "http://img.com/thumb.jpg",
            "author_url": "https://www.xiaoyuzhoufm.com/podcast/123",
        }

        processor._enrich_metadata(url, info)

        assert info["uploader"] == "Podcast Author"
        assert info["uploader_id"] == "Podcast Author"
        assert info["uploader_avatar"] == "http://img.com/author.jpg"
        assert info["thumbnail"] == "http://img.com/thumb.jpg"
        assert info["uploader_url"] == "https://www.xiaoyuzhoufm.com/podcast/123"


@pytest.mark.asyncio
async def test_enrich_bilibili(processor):
    """Test metadata enrichment for Bilibili URL."""
    info = {
        "title": "Bilibili Video",
        "uploader_id": "12345",
        "uploader_url": "",  # Empty to test enrichment
    }
    url = "https://www.bilibili.com/video/BV123"

    with patch.object(processor, "_fetch_bilibili_avatar") as mock_fetch:
        mock_fetch.return_value = "http://img.com/face.jpg"

        processor._enrich_metadata(url, info)

        assert info["uploader_url"] == "https://space.bilibili.com/12345"
        assert info["uploader_avatar"] == "http://img.com/face.jpg"


@pytest.mark.asyncio
async def test_enrich_apple(processor):
    """Test metadata enrichment for Apple Podcast URL."""
    info = {"title": "Apple Podcast", "uploader": "Unknown"}
    url = "https://podcasts.apple.com/us/podcast/id123"

    with patch.object(processor, "_fetch_apple_metadata") as mock_fetch:
        mock_fetch.return_value = {
            "author": "Apple Author",
            "author_image": "http://img.com/apple.jpg",
        }

        processor._enrich_metadata(url, info)

        assert info["uploader"] == "Apple Author"
        assert info["uploader_avatar"] == "http://img.com/apple.jpg"


def test_is_xiaoyuzhou_url(processor):
    """Test URL detection for Xiaoyuzhou."""
    assert (
        processor._is_xiaoyuzhou_url("https://www.xiaoyuzhoufm.com/episode/xyz") is True
    )
    assert processor._is_xiaoyuzhou_url("https://xiaoyuzhoufm.com/podcast/abc") is True
    assert processor._is_xiaoyuzhou_url("https://www.youtube.com/watch?v=123") is False


@pytest.mark.asyncio
async def test_extract_direct_audio_url(processor):
    """Test extraction of direct audio URL from yt-dlp info."""

    # Case 1: Audio-only format available
    info_with_audio = {
        "formats": [
            {"url": "http://video.mp4", "vcodec": "h264", "acodec": "aac"},
            {"url": "http://audio.m4a", "vcodec": "none", "acodec": "aac", "abr": 128},
            {
                "url": "http://audio_hq.m4a",
                "vcodec": "none",
                "acodec": "aac",
                "abr": 256,
            },
        ]
    }
    url = processor._extract_direct_audio_url_from_info(info_with_audio)
    assert url == "http://audio_hq.m4a"

    # Case 2: No audio-only, fallback to generic url
    info_fallback = {"url": "http://content.mp3", "formats": []}
    url = processor._extract_direct_audio_url_from_info(info_fallback)
    assert url == "http://content.mp3"

    # Case 3: Empty info
    assert processor._extract_direct_audio_url_from_info({}) is None
