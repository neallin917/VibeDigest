#!/usr/bin/env python3
import asyncio
import sys
import os
import json
import logging
from typing import List, Dict, Any

# Setup path to import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

from utils.env_loader import load_env
load_env()

from db_client import DBClient
from services.summarizer import Summarizer
from utils.text_utils import detect_language
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_json_markdown(text: str) -> str:
    if not text:
        return ""
    pattern = r"^```(?:json)?\s*(.*?)\s*```$"
    match = re.match(pattern, text.strip(), re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)
    return text.strip()

async def fix_specific_tasks():
    db = DBClient()
    
    target_ids = [
        "94bed0d9-e8b2-4cf1-b8c2-eaecd6eaefe0",
        "a60860da-31f5-4444-a85c-ea06bc0675d5",
        "662ce2f0-3394-4b8f-a467-5a1c1841eabd",
        "b4b714a5-99ed-4aa0-b8d6-7f2a8b9210f1",
        "beab3acd-0ee6-4765-9532-b3ee98eb7a86"
    ]
    
    logger.info(f"Targeting {len(target_ids)} tasks for repair...")
    
    summarizer = Summarizer()
    
    for task_id in target_ids:
        logger.info(f"\nProcessing {task_id}...")
        
        outputs = db.get_task_outputs(task_id)
        script = next((o for o in outputs if o["kind"] == "script"), None)
        
        if not script:
            logger.error("  No script found! Skipping.")
            continue
            
        script_content = script["content"]
        
        real_lang = detect_language(script_content)
        logger.info(f"  Detected Language: {real_lang}")
        
        script_raw = next((o for o in outputs if o["kind"] == "script_raw"), None)
        if script_raw:
            try:
                raw_json = json.loads(script_raw["content"])
                if raw_json.get("language") != real_lang:
                    logger.info(f"  Fixing script_raw metadata: {raw_json.get('language')} -> {real_lang}")
                    raw_json["language"] = real_lang
                    db.update_output_status(
                        script_raw["id"],
                        content=json.dumps(raw_json, ensure_ascii=False)
                    )
            except:
                pass

        logger.info("  Regenerating V4 Summary...")
        try:
            summary_result = await summarizer.summarize(
                transcript=script_content,
                target_language=real_lang
            )
            
            if summary_result:
                summary_result = clean_json_markdown(summary_result)
                
                try:
                    data = json.loads(summary_result)
                    ver = data.get("version")
                    logger.info(f"  Generated Version: {ver}")
                    
                    db.upsert_completed_task_output(
                        task_id, 
                        script["user_id"], 
                        "summary", 
                        summary_result
                    )
                    logger.info("  SUCCESS: Saved to DB.")
                    
                except json.JSONDecodeError:
                    logger.error("  FAILED: Invalid JSON generated.")
            else:
                logger.error("  FAILED: No result from LLM.")
                
        except Exception as e:
            logger.error(f"  FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(fix_specific_tasks())
