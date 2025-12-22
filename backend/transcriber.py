import os
import logging
from typing import Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

class Transcriber:
    """音频转录器，使用 OpenAI API 进行语音转文字"""
    
    def __init__(self, model_size: str = "whisper-1"):
        """
        初始化转录器
        
        Args:
            model_size: OpenAI 模型名称 (默认 whisper-1)
        """
        self.model_name = model_size
        self.client = None
        self.last_detected_language = None
        
    def _init_client(self):
        """延迟初始化 OpenAI 客户端"""
        if self.client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("未找到 OPENAI_API_KEY 环境变量")
            self.client = OpenAI(api_key=api_key)
            logger.info("OpenAI 客户端初始化完成")
    
    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> str:
        """
        转录音频文件
        
        Args:
            audio_path: 音频文件路径
            language: 指定语言（可选，如果不指定则自动检测）
            
        Returns:
            转录文本（Markdown格式）
        """
        try:
            # 检查文件是否存在
            if not os.path.exists(audio_path):
                raise Exception(f"音频文件不存在: {audio_path}")
            
            # 初始化客户端
            self._init_client()
            
            logger.info(f"开始使用 OpenAI 转录音频: {audio_path}")
            
            # 检查文件大小 (OpenAI 限制 25MB)
            file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
            logger.info(f"文件大小: {file_size_mb:.2f} MB")
            
            files_to_transcribe = []
            is_chunked = False
            
            if file_size_mb > 24.0: # 留一点余量
                logger.info("文件超过25MB，开始分片处理...")
                is_chunked = True
                files_to_transcribe = await self._split_audio(audio_path)
            else:
                files_to_transcribe = [(audio_path, 0.0)] # tuple of (path, start_offset)

            import asyncio
            all_segments = []
            detected_language = "unknown"
            
            try:
                for chunk_path, offset in files_to_transcribe:
                    logger.info(f"正在转录分片: {chunk_path} (偏移: {offset}s)")
                    
                    def _do_transcribe(path=chunk_path):
                        with open(path, "rb") as audio_file:
                            return self.client.audio.transcriptions.create(
                                model=self.model_name,
                                file=audio_file,
                                language=language,
                                response_format="verbose_json"
                            )
                    
                    transcript = await asyncio.to_thread(_do_transcribe)
                    
                    # 记录第一个分片的语言检测结果
                    if offset == 0.0:
                        detected_language = getattr(transcript, 'language', 'unknown')
                        self.last_detected_language = detected_language
                    
                    # 调整时间戳并合并
                    for segment in transcript.segments:
                        segment.start += offset
                        segment.end += offset
                        all_segments.append(segment)
                        
            finally:
                # 清理临时分片文件
                if is_chunked:
                    for chunk_path, _ in files_to_transcribe:
                        try:
                            if os.path.exists(chunk_path):
                                os.remove(chunk_path)
                        except Exception as e:
                            logger.warning(f"清理临时文件失败 {chunk_path}: {e}")

            logger.info(f"检测到的语言: {detected_language}")
            
            # 组装转录结果
            transcript_lines = []
            transcript_lines.append("# Video Transcription")
            transcript_lines.append("")
            transcript_lines.append(f"**Detected Language:** {detected_language}")
            transcript_lines.append("")
            transcript_lines.append("## Transcription Content")
            transcript_lines.append("")
            
            # 优化后的格式: 分段聚合 (Paragraph Aggregation)
            # 策略: 
            # 1. 如果两句之间间隔超过 2.0秒 -> 新段落
            # 2. 如果当前段落累计超 500字符 -> 新段落
            
            paragraphs = []
            if all_segments:
                current_para = {
                    "start": all_segments[0].start,
                    "text": all_segments[0].text.strip(),
                    "end": all_segments[0].end
                }
                
                for i in range(1, len(all_segments)):
                    seg = all_segments[i]
                    text = seg.text.strip()
                    if not text:
                        continue
                        
                    # 计算间隔
                    gap = seg.start - current_para["end"]
                    current_len = len(current_para["text"])
                    
                    # 触发新段落条件
                    should_split = (gap > 2.0) or (current_len > 500)
                    
                    if should_split:
                        paragraphs.append(current_para)
                        current_para = {
                            "start": seg.start,
                            "text": text,
                            "end": seg.end
                        }
                    else:
                        # 合并
                        current_para["text"] += " " + text
                        current_para["end"] = seg.end
                
                # 添加最后一段
                paragraphs.append(current_para)

            for para in paragraphs:
                start_time = self._format_time(para["start"])
                text = para["text"]
                # 加粗时间戳，段落间空行
                transcript_lines.append(f"**[{start_time}]** {text}")
                transcript_lines.append("")
            
            transcript_text = "\n".join(transcript_lines)

            logger.info("转录完成")
            
            return transcript_text
            
        except Exception as e:
            logger.error(f"转录失败: {str(e)}")
            raise Exception(f"转录失败: {str(e)}")

    async def _split_audio(self, audio_path: str, chunk_length_ms: int = 10 * 60 * 1000) -> list:
        """
        使用 pydub 将音频切分为多个小片段
        
        Args:
            audio_path: 原音频路径
            chunk_length_ms: 切片长度（毫秒），默认10分钟
            
        Returns:
            list: [(chunk_path, start_offset_seconds), ...]
        """
        import asyncio
        from pydub import AudioSegment
        
        def _do_split():
            try:
                # pydub 依赖 ffmpeg，scripts/start.py 已检查
                audio = AudioSegment.from_file(audio_path)
                duration_ms = len(audio)
                chunks = []
                
                base_name = os.path.splitext(audio_path)[0]
                
                for i, start_ms in enumerate(range(0, duration_ms, chunk_length_ms)):
                    end_ms = min(start_ms + chunk_length_ms, duration_ms)
                    chunk = audio[start_ms:end_ms]
                    
                    chunk_filename = f"{base_name}_part{i}.mp3"
                    # 导出为 mp3 以减小体积
                    chunk.export(chunk_filename, format="mp3")
                    
                    chunks.append((chunk_filename, start_ms / 1000.0))
                
                return chunks
            except Exception as e:
                logger.error(f"音频切片失败: {e}")
                raise e

        # 这是一个耗时操作，放入线程池
        return await asyncio.to_thread(_do_split)
    
    def _format_time(self, seconds: float) -> str:
        """
        将秒数转换为时分秒格式 MM:SS 或 HH:MM:SS
        """
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        seconds = seconds % 60
        
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes:02d}:{seconds:02d}"
    
    def get_supported_languages(self) -> list:
        """
        获取支持的语言列表 (OpenAI Whisper 支持的常用语言)
        """
        return [
            "zh", "en", "ja", "ko", "es", "fr", "de", "it", "pt", "ru",
            "ar", "hi", "th", "vi", "tr", "pl", "nl", "sv", "da", "no"
        ]
    
    def get_detected_language(self, transcript_text: Optional[str] = None) -> Optional[str]:
        """
        获取检测到的语言
        """
        # 如果有保存的语言，直接返回
        if self.last_detected_language:
            return self.last_detected_language
        
        # 如果提供了转录文本，尝试从中提取语言信息
        if transcript_text and "**Detected Language:**" in transcript_text:
            lines = transcript_text.split('\n')
            for line in lines:
                if "**Detected Language:**" in line:
                    lang = line.split(":")[-1].strip()
                    return lang
        
        return None
