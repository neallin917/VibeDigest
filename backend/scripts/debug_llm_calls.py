#!/usr/bin/env python3
"""
Debug script to trace LLM calls step-by-step in the cognition workflow.

Usage:
    cd backend
    python scripts/debug_llm_calls.py

This script simulates the cognition workflow with detailed timing and logging
to identify which step triggers rate limiting.
"""

import asyncio
import time
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
from dotenv import load_dotenv
load_dotenv()

from config import settings
from summarizer import Summarizer

# ANSI colors for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def log_step(step_num: int, name: str, status: str = "START"):
    """Log a step with timestamp and color."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]

    if status == "START":
        color = Colors.BLUE
        symbol = "▶"
    elif status == "SUCCESS":
        color = Colors.GREEN
        symbol = "✓"
    elif status == "ERROR":
        color = Colors.RED
        symbol = "✗"
    else:
        color = Colors.YELLOW
        symbol = "⏳"

    print(f"{color}{symbol} [{timestamp}] Step {step_num}: {name} - {status}{Colors.RESET}")

def log_info(message: str):
    """Log info message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{Colors.CYAN}  ℹ [{timestamp}] {message}{Colors.RESET}")

def log_error(message: str):
    """Log error message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{Colors.RED}  ✗ [{timestamp}] ERROR: {message}{Colors.RESET}")

# Sample transcript for testing (short version to minimize tokens)
SAMPLE_TRANSCRIPT = """
今天我们来聊一聊人工智能的发展历程。

人工智能最早可以追溯到1950年代，当时图灵提出了著名的图灵测试。
这个测试的核心思想是：如果一台机器能够与人类进行对话，
而人类无法分辨对方是机器还是人，那么这台机器就可以被认为具有智能。

随后，在1956年的达特茅斯会议上，"人工智能"这个术语正式被提出。
这次会议被认为是人工智能作为一个学科诞生的标志。

进入21世纪后，深度学习技术的突破带来了人工智能的爆发式增长。
2012年，AlexNet在ImageNet图像识别比赛中取得了突破性的成绩。
2016年，AlphaGo击败了世界围棋冠军李世石，引起了全球的关注。

如今，大语言模型如GPT和Claude正在改变我们与计算机交互的方式。
这些模型能够理解和生成自然语言，在翻译、写作、编程等领域发挥着重要作用。

总结来说，人工智能经历了从理论探索到实际应用的漫长发展过程。
未来，人工智能将继续深刻地影响我们的生活和工作方式。
"""


async def test_step_by_step():
    """Run each LLM call step separately with timing."""

    print(f"\n{Colors.BOLD}{'='*60}")
    print("LLM Call Debug Script - Step by Step Testing")
    print(f"{'='*60}{Colors.RESET}\n")

    # Show current config
    print(f"{Colors.YELLOW}Current Configuration:{Colors.RESET}")
    print(f"  - COGNITION_SEQUENTIAL: {settings.COGNITION_SEQUENTIAL}")
    print(f"  - COGNITION_DELAY: {settings.COGNITION_DELAY}s")
    print(f"  - SUMMARY_STRATEGY: {settings.SUMMARY_STRATEGY}")
    print(f"  - LLM_PROVIDER: {settings.LLM_PROVIDER}")
    print(f"  - MODEL_ALIAS_SMART: {settings.MODEL_ALIAS_SMART}")
    print(f"  - MODEL_ALIAS_FAST: {settings.MODEL_ALIAS_FAST}")
    print(f"  - OPENAI_BASE_URL: {settings.OPENAI_BASE_URL or 'Not set (using default)'}")
    print()

    summarizer = Summarizer()

    # Trace metadata for debugging
    trace_meta = {
        "session_id": "debug-test-001",
        "user_id": "debug-user",
        "metadata": {"source": "debug_script"},
    }

    results = {
        "classification": None,
        "summary": None,
    }

    call_count = 0

    # ============================================================
    # STEP 1: Classification
    # ============================================================
    print(f"\n{Colors.BOLD}--- STEP 1: Classification (classify_content) ---{Colors.RESET}")
    log_step(1, "classify_content", "START")

    input(f"{Colors.YELLOW}Press Enter to execute Step 1...{Colors.RESET}")

    start_time = time.time()
    try:
        call_count += 1
        log_info(f"LLM Call #{call_count} starting...")

        classification = await summarizer.classify_content(
            SAMPLE_TRANSCRIPT,
            trace_metadata=trace_meta
        )

        elapsed = time.time() - start_time
        log_step(1, "classify_content", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result: {classification}")
        results["classification"] = classification

    except Exception as e:
        elapsed = time.time() - start_time
        log_step(1, "classify_content", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s: {e}")

        # Ask if user wants to continue
        cont = input(f"{Colors.YELLOW}Continue to next step? (y/n): {Colors.RESET}")
        if cont.lower() != 'y':
            return

    # ============================================================
    # STEP 2: Summarize WITHOUT classification (simulating the bug)
    # ============================================================
    print(f"\n{Colors.BOLD}--- STEP 2: Summarize WITHOUT existing_classification (BUG SIMULATION) ---{Colors.RESET}")
    log_step(2, "summarize (no classification passed)", "START")
    log_info("This simulates the current bug - summarize() will call classify_content() again!")

    input(f"{Colors.YELLOW}Press Enter to execute Step 2...{Colors.RESET}")

    start_time = time.time()
    try:
        call_count += 1  # classify inside summarize
        log_info(f"LLM Call #{call_count} (internal classify) + LLM Call #{call_count+1} (summarize) starting...")
        call_count += 1

        # NOTE: Not passing existing_classification - this is the bug!
        summary = await summarizer.summarize(
            SAMPLE_TRANSCRIPT,
            target_language="zh",
            trace_metadata=trace_meta,
            # existing_classification=results["classification"],  # <-- BUG: Not passed!
        )

        elapsed = time.time() - start_time
        log_step(2, "summarize (no classification)", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result length: {len(summary)} chars")
        results["summary"] = summary

    except Exception as e:
        elapsed = time.time() - start_time
        log_step(2, "summarize (no classification)", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s: {e}")

        # This is likely where rate limit occurs!
        if "rate" in str(e).lower() or "limit" in str(e).lower() or "wait" in str(e).lower():
            print(f"\n{Colors.RED}{Colors.BOLD}{'='*60}")
            print("🚨 RATE LIMIT DETECTED!")
            print("This confirms the bug: summarize() is calling classify_content()")
            print("again because existing_classification was not passed.")
            print(f"{'='*60}{Colors.RESET}\n")

    # ============================================================
    # STEP 3: Summarize WITH classification (the fix)
    # ============================================================
    print(f"\n{Colors.BOLD}--- STEP 3: Summarize WITH existing_classification (FIX) ---{Colors.RESET}")
    log_step(3, "summarize (with classification)", "START")
    log_info("This shows the correct behavior - reusing the classification result")

    # Wait for user input
    wait_time = input(f"{Colors.YELLOW}Enter wait time in seconds before Step 3 (or press Enter for 0): {Colors.RESET}")
    try:
        wait_seconds = float(wait_time) if wait_time.strip() else 0
        if wait_seconds > 0:
            log_info(f"Waiting {wait_seconds}s before next call...")
            await asyncio.sleep(wait_seconds)
    except ValueError:
        pass

    start_time = time.time()
    try:
        call_count += 1
        log_info(f"LLM Call #{call_count} starting (only summarize, no classify)...")

        # FIX: Pass existing classification!
        summary_fixed = await summarizer.summarize(
            SAMPLE_TRANSCRIPT,
            target_language="zh",
            existing_classification=results["classification"],  # <-- FIX: Passed!
            trace_metadata=trace_meta,
        )

        elapsed = time.time() - start_time
        log_step(3, "summarize (with classification)", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result length: {len(summary_fixed)} chars")

    except Exception as e:
        elapsed = time.time() - start_time
        log_step(3, "summarize (with classification)", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s: {e}")

    # ============================================================
    # Summary
    # ============================================================
    print(f"\n{Colors.BOLD}{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}{Colors.RESET}")
    print(f"Total LLM calls made: {call_count}")
    print()
    print("Expected calls (with bug):   3 (classify + classify_again + summarize)")
    print("Expected calls (with fix):   2 (classify + summarize)")
    print()

    if results["classification"]:
        print(f"{Colors.GREEN}✓ Classification succeeded{Colors.RESET}")
    else:
        print(f"{Colors.RED}✗ Classification failed{Colors.RESET}")

    if results["summary"]:
        print(f"{Colors.GREEN}✓ Summary succeeded{Colors.RESET}")
    else:
        print(f"{Colors.RED}✗ Summary failed (likely rate limited){Colors.RESET}")


async def test_individual_call():
    """Test a single LLM call to verify basic connectivity."""

    print(f"\n{Colors.BOLD}{'='*60}")
    print("Single LLM Call Test")
    print(f"{'='*60}{Colors.RESET}\n")

    summarizer = Summarizer()

    print("Testing a single classify_content call...")
    log_step(1, "classify_content", "START")

    start_time = time.time()
    try:
        result = await summarizer.classify_content(SAMPLE_TRANSCRIPT[:500])
        elapsed = time.time() - start_time
        log_step(1, "classify_content", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result: {result}")
        return True
    except Exception as e:
        elapsed = time.time() - start_time
        log_step(1, "classify_content", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s: {e}")
        return False


def main():
    print(f"\n{Colors.BOLD}LLM Call Debugger{Colors.RESET}")
    print("1. Test step-by-step (full workflow)")
    print("2. Test single LLM call (connectivity check)")
    print("3. Exit")

    choice = input(f"\n{Colors.YELLOW}Select option (1/2/3): {Colors.RESET}")

    if choice == "1":
        asyncio.run(test_step_by_step())
    elif choice == "2":
        asyncio.run(test_individual_call())
    else:
        print("Exiting.")


if __name__ == "__main__":
    main()
