import logging
import re
from typing import Optional
from config import settings
from utils.openai_client import get_openai_client
from utils.text_utils import LANGUAGE_MAP, detect_language, smart_chunk_text
from prompts import TRANSLATE_SYSTEM, TRANSLATE_USER, TRANSLATE_CHUNK_SYSTEM
import asyncio

logger = logging.getLogger(__name__)

class Translator:
    """文本翻译器，使用GPT-4o进行高质量翻译"""
    
    def __init__(self):
        self.client = get_openai_client()
        if self.client:
             logger.info("OpenAI客户端初始化成功 (Translator)")
        else:
             logger.warning("OpenAI API不可用 (Translator)")
        self.language_map = LANGUAGE_MAP
    
    async def translate_text(self, text: str, target_language: str, source_language: Optional[str] = None) -> str:
        """
        翻译文本到目标语言
        
        Args:
            text: 要翻译的文本
            target_language: 目标语言代码
            source_language: 源语言代码（可选，会自动检测）
            
        Returns:
            翻译后的文本
        """
        try:
            if not self.client:
                logger.warning("OpenAI API不可用，无法翻译")
                return text
            
            if not source_language:
                source_language = detect_language(text)
            
            # 如果源语言和目标语言相同，直接返回
            if source_language == target_language:
                return text
            
            source_lang_name = self.language_map.get(source_language, source_language)
            target_lang_name = self.language_map.get(target_language, target_language)
            
            logger.info(f"开始翻译：{source_lang_name} -> {target_lang_name}")
            
            # 估算文本长度，决定是否需要分块
            if len(text) > 3000:
                logger.info(f"文本较长({len(text)} chars)，启用分块翻译")
                return await self._translate_with_chunks(text, target_lang_name, source_lang_name)
            else:
                return await self._translate_single_text(text, target_lang_name, source_lang_name)
                
        except Exception as e:
            logger.error(f"翻译失败: {str(e)}")
            return text
    
    async def _translate_single_text(self, text: str, target_lang_name: str, source_lang_name: str) -> str:
        """翻译单个文本块"""
        system_prompt = TRANSLATE_SYSTEM.format(source_lang=source_lang_name, target_lang=target_lang_name)
        user_prompt = TRANSLATE_USER.format(source_lang=source_lang_name, target_lang=target_lang_name, text=text)

        try:
            def _call():
                return self.client.chat.completions.create(
                    model=settings.OPENAI_TRANSLATION_MODEL,
                    name="Text Translation",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_completion_tokens=4000
                )
            
            response = await asyncio.to_thread(_call)
            return response.choices[0].message.content
            
        except Exception as e:
            logger.error(f"单文本翻译失败: {e}")
            return text
    
    async def _translate_with_chunks(self, text: str, target_lang_name: str, source_lang_name: str) -> str:
        """分块翻译长文本"""
        chunks = smart_chunk_text(text, max_chars=4000)
        logger.info(f"分割为 {len(chunks)} 个块进行翻译")
        
        translated_chunks = []
        for i, chunk in enumerate(chunks):
            logger.info(f"正在翻译第 {i+1}/{len(chunks)} 块...")
            
            system_prompt = TRANSLATE_CHUNK_SYSTEM.format(
                source_lang=source_lang_name,
                target_lang=target_lang_name,
                current_part=i+1,
                total_parts=len(chunks)
            )
            user_prompt = TRANSLATE_USER.format(source_lang=source_lang_name, target_lang=target_lang_name, text=chunk)

            try:
                def _call():
                    return self.client.chat.completions.create(
                        model=settings.OPENAI_TRANSLATION_MODEL,
                        name=f"Chunk Translation ({i+1}/{len(chunks)})",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        max_completion_tokens=4000
                    )
                
                response = await asyncio.to_thread(_call)
                translated_chunks.append(response.choices[0].message.content)
                
            except Exception as e:
                logger.error(f"翻译第 {i+1} 块失败: {e}")
                translated_chunks.append(chunk)
        
        return "\n\n".join(translated_chunks)
    
    def should_translate(self, source_language: str, target_language: str) -> bool:
        """判断是否需要翻译"""
        if not source_language or not target_language:
            return False
        
        # 标准化语言代码
        source_lang = source_language.lower().strip()
        target_lang = target_language.lower().strip()
        
        # 如果语言相同，不需要翻译
        if source_lang == target_lang:
            return False
        
        # 处理中文的特殊情况
        chinese_variants = ["zh", "zh-cn", "zh-hans", "chinese"]
        if source_lang in chinese_variants and target_lang in chinese_variants:
            return False
        
        return True
