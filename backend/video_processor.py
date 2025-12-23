import os
import yt_dlp
import logging
from pathlib import Path
from typing import Optional
import re
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
import json

logger = logging.getLogger(__name__)

class VideoProcessor:
    """视频处理器，使用yt-dlp下载和转换视频"""
    
    def __init__(self):
        self.ydl_opts = {
            'format': 'bestaudio/best',  # 优先下载最佳音频源
            'outtmpl': '%(title)s.%(ext)s',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                # 直接在提取阶段转换为单声道 16k（空间小且稳定）
                'preferredcodec': 'm4a',
                'preferredquality': '192'
            }],
            # 全局FFmpeg参数：单声道 + 16k 采样率 + faststart
            'postprocessor_args': ['-ac', '1', '-ar', '16000', '-movflags', '+faststart'],
            'prefer_ffmpeg': True,
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,  # 强制只下载单个视频，不下载播放列表
        }

    def _is_xiaoyuzhou_url(self, url: str) -> bool:
        try:
            host = (urlparse(url).hostname or "").replace("www.", "")
            return host.endswith("xiaoyuzhoufm.com")
        except Exception:
            return False

    def _fetch_og_image(self, page_url: str, timeout_seconds: float = 8.0) -> Optional[str]:
        """
        Fetch episode page HTML and extract og:image.
        Best-effort, used only for xiaoyuzhou episode pages.
        """
        try:
            req = Request(
                page_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; VibeDigest/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                },
                method="GET",
            )
            with urlopen(req, timeout=timeout_seconds) as resp:
                raw = resp.read(1024 * 1024)  # cap 1MB
            html = raw.decode("utf-8", errors="ignore")

            m = re.search(
                r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
                html,
                flags=re.IGNORECASE,
            )
            if m:
                return m.group(1).strip()

            m = re.search(
                r'<meta[^>]+name=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
                html,
                flags=re.IGNORECASE,
            )
            if m:
                return m.group(1).strip()

            return None
        except (HTTPError, URLError, TimeoutError) as e:
            logger.warning(f"获取 og:image 失败（非致命）: {e}")
            return None
        except Exception as e:
            logger.warning(f"解析 og:image 失败（非致命）: {e}")
            return None

    def _fetch_xiaoyuzhou_episode_cover(self, page_url: str, timeout_seconds: float = 8.0) -> Optional[str]:
        """
        Xiaoyuzhou episode pages embed richer data in __NEXT_DATA__.
        This is usually the true episode cover, while og:image may be podcast/author cover.
        """
        try:
            req = Request(
                page_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; VibeDigest/1.0)",
                    "Accept": "text/html,application/xhtml+xml",
                },
                method="GET",
            )
            with urlopen(req, timeout=timeout_seconds) as resp:
                raw = resp.read(1024 * 1024)  # cap 1MB
            html = raw.decode("utf-8", errors="ignore")

            m = re.search(
                r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
                html,
                flags=re.IGNORECASE | re.DOTALL,
            )
            if not m:
                return None

            data = json.loads(m.group(1))
            episode = (
                (data.get("props") or {})
                .get("pageProps", {})
                .get("episode", {})
            )
            image = (episode.get("image") or {}) if isinstance(episode, dict) else {}

            # Prefer largest, fall back
            for k in ("largePicUrl", "middlePicUrl", "smallPicUrl", "picUrl", "thumbnailUrl"):
                v = image.get(k)
                if isinstance(v, str) and v:
                    return v
            return None
        except Exception as e:
            logger.warning(f"解析 xiaoyuzhou episode 封面失败（非致命）: {e}")
            return None

    def _extract_direct_audio_url_from_info(self, info: dict) -> Optional[str]:
        """
        Best-effort: extract a direct audio URL from yt-dlp info dict.
        This avoids uploading to any storage; frontend can play via <audio src>.
        """
        if not info:
            return None

        # Playlist / wrapper
        if isinstance(info.get("entries"), list) and info["entries"]:
            first = info["entries"][0]
            if isinstance(first, dict):
                info = first

        # Prefer audio-only formats
        formats = info.get("formats") or []
        audio_formats = []
        for f in formats:
            if not isinstance(f, dict):
                continue
            url = f.get("url")
            if not url:
                continue
            vcodec = f.get("vcodec")
            acodec = f.get("acodec")
            if vcodec == "none" and acodec and acodec != "none":
                audio_formats.append(f)

        def score(f: dict) -> float:
            # Prefer higher bitrate; fall back to whatever exists.
            for k in ("abr", "tbr", "asr"):
                v = f.get(k)
                try:
                    if v is not None:
                        return float(v)
                except Exception:
                    continue
            return 0.0

        if audio_formats:
            best = sorted(audio_formats, key=score, reverse=True)[0]
            return best.get("url")

        # Fallback: some extractors provide a single URL directly
        url = info.get("url")
        if isinstance(url, str) and url:
            return url
        return None
    
    async def download_and_convert(self, url: str, output_dir: Path) -> tuple[str, str, Optional[str], Optional[str]]:
        """
        下载视频并转换为m4a格式
        
        Args:
            url: 视频链接
            output_dir: 输出目录
            
        Returns:
            转换后的音频文件路径
        """
        try:
            # 创建输出目录
            output_dir.mkdir(exist_ok=True)
            
            # 生成唯一的文件名
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            output_template = str(output_dir / f"audio_{unique_id}.%(ext)s")
            
            # 更新yt-dlp选项
            ydl_opts = self.ydl_opts.copy()
            ydl_opts['outtmpl'] = output_template
            
            logger.info(f"开始下载视频: {url}")
            
            # 直接同步执行，不使用线程池
            # 在FastAPI中，IO密集型操作可以直接await
            import asyncio
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 获取视频信息（放到线程池避免阻塞事件循环）
                info = await asyncio.to_thread(ydl.extract_info, url, False)
                video_title = info.get('title', 'unknown')
                expected_duration = info.get('duration') or 0
                direct_audio_url = self._extract_direct_audio_url_from_info(info)
                logger.info(f"视频标题: {video_title}")
                
                # 下载视频（放到线程池避免阻塞事件循环）
                await asyncio.to_thread(ydl.download, [url])
            
            # 查找生成的m4a文件
            audio_file = str(output_dir / f"audio_{unique_id}.m4a")
            
            if not os.path.exists(audio_file):
                # 如果m4a文件不存在，查找其他音频格式
                for ext in ['webm', 'mp4', 'mp3', 'wav']:
                    potential_file = str(output_dir / f"audio_{unique_id}.{ext}")
                    if os.path.exists(potential_file):
                        audio_file = potential_file
                        break
                else:
                    raise Exception("未找到下载的音频文件")
            
            # 校验时长，如果和源视频差异较大，尝试一次ffmpeg规范化重封装
            try:
                import subprocess, shlex
                probe_cmd = f"ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 {shlex.quote(audio_file)}"
                out = subprocess.check_output(probe_cmd, shell=True).decode().strip()
                actual_duration = float(out) if out else 0.0
            except Exception as _:
                actual_duration = 0.0
            
            if expected_duration and actual_duration and abs(actual_duration - expected_duration) / expected_duration > 0.1:
                logger.warning(
                    f"音频时长异常，期望{expected_duration}s，实际{actual_duration}s，尝试重封装修复…"
                )
                try:
                    fixed_path = str(output_dir / f"audio_{unique_id}_fixed.m4a")
                    fix_cmd = f"ffmpeg -y -i {shlex.quote(audio_file)} -vn -c:a aac -b:a 160k -movflags +faststart {shlex.quote(fixed_path)}"
                    subprocess.check_call(fix_cmd, shell=True)
                    # 用修复后的文件替换
                    audio_file = fixed_path
                    # 重新探测
                    out2 = subprocess.check_output(probe_cmd.replace(shlex.quote(audio_file.rsplit('.',1)[0]+'.m4a'), shlex.quote(audio_file)), shell=True).decode().strip()
                    actual_duration2 = float(out2) if out2 else 0.0
                    logger.info(f"重封装完成，新时长≈{actual_duration2:.2f}s")
                except Exception as e:
                    logger.error(f"重封装失败：{e}")
            
            # Extract thumbnail (best effort)
            thumbnail = info.get('thumbnail')
            # For xiaoyuzhou, prefer episode cover from og:image over podcast/author cover
            if self._is_xiaoyuzhou_url(url):
                episode_cover = self._fetch_xiaoyuzhou_episode_cover(url)
                if episode_cover:
                    thumbnail = episode_cover
                else:
                    og_image = self._fetch_og_image(url)
                    if og_image:
                        thumbnail = og_image
            
            logger.info(f"音频文件已保存: {audio_file}")
            return audio_file, video_title, thumbnail, direct_audio_url
            
        except Exception as e:
            logger.error(f"下载视频失败: {str(e)}")
            raise Exception(f"下载视频失败: {str(e)}")
    
    def get_video_info(self, url: str) -> dict:
        """
        获取视频信息
        
        Args:
            url: 视频链接
            
        Returns:
            视频信息字典
        """
        try:
            with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
                info = ydl.extract_info(url, download=False)
                return {
                    'title': info.get('title', ''),
                    'duration': info.get('duration', 0),
                    'uploader': info.get('uploader', ''),
                    'upload_date': info.get('upload_date', ''),
                    'description': info.get('description', ''),
                    'view_count': info.get('view_count', 0),
                }
        except Exception as e:
            logger.error(f"获取视频信息失败: {str(e)}")
            raise Exception(f"获取视频信息失败: {str(e)}")
