import logging
import os
from typing import Optional
from config import settings
# from utils.openai_client import get_openai_client # Deprecated for Translator
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from utils.text_utils import LANGUAGE_MAP, detect_language, smart_chunk_text
from prompts import TRANSLATE_SYSTEM, TRANSLATE_USER, TRANSLATE_CHUNK_SYSTEM
import asyncio

logger = logging.getLogger(__name__)

class Translator:
    """文本翻译器，使用 LangChain ChatOpenAI 进行高质量翻译"""
    
    def __init__(self):
        self.language_map = LANGUAGE_MAP
        # Initialize ChatOpenAI client
        # We rely on OPENAI_API_KEY env var being set
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL")
        
        if api_key:
             logger.info("ChatOpenAI initialized (Translator)")
             # Initialize with default translation model
             self.llm = ChatOpenAI(
                 model=settings.OPENAI_TRANSLATION_MODEL,
                 api_key=api_key,
                 base_url=base_url,
                 temperature=0.3, # Slightly lower temp for translation consistency
                 max_tokens=4000
             )
        else:
             logger.warning("OpenAI API Key missing, Translator will fail.")
             self.llm = None
    
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
            if not self.llm:
                logger.warning("ChatOpenAI API不可用，无法翻译")
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
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt)
            ]
            # Use ainvoke for native async
            response = await self.llm.ainvoke(messages, config={"run_name": "Text Translation"})
            return response.content
            
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
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                # Use ainvoke with specific run name for tracing
                response = await self.llm.ainvoke(
                    messages, 
                    config={"run_name": f"Chunk Translation ({i+1}/{len(chunks)})"}
                )
                translated_chunks.append(response.content)
                
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
