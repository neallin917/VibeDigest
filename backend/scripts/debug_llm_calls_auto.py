#!/usr/bin/env python3
"""
Auto-run debug script to trace LLM calls step-by-step in the cognition workflow.
Non-interactive version for automated testing.

Usage:
    cd backend
    python scripts/debug_llm_calls_auto.py
"""

import asyncio
import time
import os
import sys
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment from project root
from dotenv import load_dotenv
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_local = os.path.join(project_root, ".env.local")
env_production = os.path.join(project_root, ".env.production")

# Try .env.local first, then .env.production
if os.path.exists(env_local):
    load_dotenv(env_local)
    print(f"Loaded env from: {env_local}")
elif os.path.exists(env_production):
    load_dotenv(env_production)
    print(f"Loaded env from: {env_production}")
else:
    load_dotenv()
    print("Using default dotenv loading")

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

    print(f"{color}{symbol} [{timestamp}] Step {step_num}: {name} - {status}{Colors.RESET}", flush=True)

def log_info(message: str):
    """Log info message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{Colors.CYAN}  ℹ [{timestamp}] {message}{Colors.RESET}", flush=True)

def log_error(message: str):
    """Log error message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{Colors.RED}  ✗ [{timestamp}] ERROR: {message}{Colors.RESET}", flush=True)

# Short sample transcript for testing (minimize tokens)
SAMPLE_TRANSCRIPT = """
今天我们来聊一聊人工智能的发展历程。

人工智能最早可以追溯到1950年代，当时图灵提出了著名的图灵测试。
这个测试的核心思想是：如果一台机器能够与人类进行对话，
而人类无法分辨对方是机器还是人，那么这台机器就可以被认为具有智能。

随后，在1956年的达特茅斯会议上，"人工智能"这个术语正式被提出。

进入21世纪后，深度学习技术的突破带来了人工智能的爆发式增长。
2016年，AlphaGo击败了世界围棋冠军李世石，引起了全球的关注。

如今，大语言模型如GPT和Claude正在改变我们与计算机交互的方式。
"""


async def test_step_by_step():
    """Run each LLM call step separately with timing."""

    print(f"\n{Colors.BOLD}{'='*60}")
    print("LLM Call Debug Script - Auto Run Mode")
    print(f"{'='*60}{Colors.RESET}\n", flush=True)

    # Show current config
    print(f"{Colors.YELLOW}Current Configuration:{Colors.RESET}")
    print(f"  - COGNITION_SEQUENTIAL: {settings.COGNITION_SEQUENTIAL}")
    print(f"  - COGNITION_DELAY: {settings.COGNITION_DELAY}s")
    print(f"  - SUMMARY_STRATEGY: {settings.SUMMARY_STRATEGY}")
    print(f"  - LLM_PROVIDER: {settings.LLM_PROVIDER}")
    print(f"  - MODEL_ALIAS_SMART: {settings.MODEL_ALIAS_SMART}")
    print(f"  - MODEL_ALIAS_FAST: {settings.MODEL_ALIAS_FAST}")
    print(f"  - OPENAI_BASE_URL: {settings.OPENAI_BASE_URL or 'Not set'}")
    print(flush=True)

    summarizer = Summarizer()

    # Trace metadata for debugging
    trace_meta = {
        "session_id": "debug-test-001",
        "user_id": "debug-user",
        "metadata": {"source": "debug_script"},
    }

    results = {
        "step1_classification": None,
        "step1_time": None,
        "step1_error": None,
        "step2_summary": None,
        "step2_time": None,
        "step2_error": None,
    }

    call_times = []

    # ============================================================
    # STEP 1: Classification Only
    # ============================================================
    print(f"\n{Colors.BOLD}--- STEP 1: Classification (classify_content) ---{Colors.RESET}", flush=True)
    log_step(1, "classify_content", "START")

    start_time = time.time()
    call_times.append(("Step1 Start", start_time))

    try:
        classification = await summarizer.classify_content(
            SAMPLE_TRANSCRIPT,
            trace_metadata=trace_meta
        )

        elapsed = time.time() - start_time
        call_times.append(("Step1 End", time.time()))

        log_step(1, "classify_content", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result: {classification}")

        results["step1_classification"] = classification
        results["step1_time"] = elapsed

    except Exception as e:
        elapsed = time.time() - start_time
        call_times.append(("Step1 Error", time.time()))

        log_step(1, "classify_content", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s: {e}")
        results["step1_error"] = str(e)

        # If step 1 fails, we can't continue
        print(f"\n{Colors.RED}Step 1 failed. Cannot continue.{Colors.RESET}")
        return results

    # ============================================================
    # STEP 2: Summarize WITHOUT classification (simulating the bug)
    # ============================================================
    print(f"\n{Colors.BOLD}--- STEP 2: Summarize WITHOUT existing_classification ---{Colors.RESET}", flush=True)
    print(f"{Colors.YELLOW}(This simulates current bug - will call classify_content again internally!){Colors.RESET}", flush=True)
    log_step(2, "summarize (no classification passed)", "START")
    log_info("Expected: 2 LLM calls (classify again + summarize)")

    # Small delay to see timing clearly
    await asyncio.sleep(0.5)

    start_time = time.time()
    call_times.append(("Step2 Start", start_time))

    try:
        # NOTE: Not passing existing_classification - this is the bug!
        summary = await summarizer.summarize(
            SAMPLE_TRANSCRIPT,
            target_language="zh",
            trace_metadata=trace_meta,
            # existing_classification=results["step1_classification"],  # <-- BUG: Not passed!
        )

        elapsed = time.time() - start_time
        call_times.append(("Step2 End", time.time()))

        log_step(2, "summarize (no classification)", "SUCCESS")
        log_info(f"Took {elapsed:.2f}s")
        log_info(f"Result length: {len(summary)} chars")

        results["step2_summary"] = summary[:200] + "..." if len(summary) > 200 else summary
        results["step2_time"] = elapsed

    except Exception as e:
        elapsed = time.time() - start_time
        call_times.append(("Step2 Error", time.time()))

        log_step(2, "summarize (no classification)", "ERROR")
        log_error(f"Failed after {elapsed:.2f}s")
        log_error(f"Exception type: {type(e).__name__}")
        log_error(f"Exception message: {str(e)[:500]}")

        results["step2_error"] = str(e)

        # Check if rate limit
        error_str = str(e).lower()
        if "rate" in error_str or "limit" in error_str or "wait" in error_str or "limited" in error_str:
            print(f"\n{Colors.RED}{Colors.BOLD}{'='*60}")
            print("🚨 RATE LIMIT DETECTED!")
            print("="*60)
            print(f"This confirms the bug:")
            print(f"  - Step 1 called classify_content() ✓")
            print(f"  - Step 2's summarize() called classify_content() AGAIN internally")
            print(f"  - Total: 3 LLM calls in quick succession -> RATE LIMITED")
            print(f"")
            print(f"FIX: Pass existing_classification to summarize()")
            print(f"{'='*60}{Colors.RESET}\n", flush=True)

    # ============================================================
    # Summary
    # ============================================================
    print(f"\n{Colors.BOLD}{'='*60}")
    print("TEST RESULTS SUMMARY")
    print(f"{'='*60}{Colors.RESET}", flush=True)

    # Timeline
    print(f"\n{Colors.CYAN}Timeline:{Colors.RESET}")
    base_time = call_times[0][1] if call_times else 0
    for label, t in call_times:
        relative = t - base_time
        print(f"  +{relative:6.2f}s : {label}")

    # Results
    print(f"\n{Colors.CYAN}Results:{Colors.RESET}")
    if results["step1_classification"]:
        print(f"  {Colors.GREEN}✓ Step 1 (classify): SUCCESS in {results['step1_time']:.2f}s{Colors.RESET}")
    else:
        print(f"  {Colors.RED}✗ Step 1 (classify): FAILED - {results['step1_error'][:100]}{Colors.RESET}")

    if results["step2_summary"]:
        print(f"  {Colors.GREEN}✓ Step 2 (summarize): SUCCESS in {results['step2_time']:.2f}s{Colors.RESET}")
    else:
        print(f"  {Colors.RED}✗ Step 2 (summarize): FAILED - {results['step2_error'][:100] if results['step2_error'] else 'Unknown'}{Colors.RESET}")

    # Diagnosis
    print(f"\n{Colors.CYAN}Diagnosis:{Colors.RESET}")
    if results["step1_classification"] and not results["step2_summary"] and results["step2_error"]:
        if "wait" in results["step2_error"].lower() or "limit" in results["step2_error"].lower():
            print(f"  {Colors.RED}🐛 BUG CONFIRMED: Rate limit triggered because summarize()")
            print(f"     internally calls classify_content() again.{Colors.RESET}")
            print(f"  {Colors.GREEN}💡 FIX: Pass existing_classification parameter to summarize(){Colors.RESET}")
    elif results["step1_classification"] and results["step2_summary"]:
        print(f"  {Colors.GREEN}✓ No rate limit issue detected in this test run.{Colors.RESET}")
        print(f"  {Colors.YELLOW}  Note: The bug may still exist but API didn't rate limit this time.{Colors.RESET}")
    elif not results["step1_classification"]:
        print(f"  {Colors.RED}✗ Step 1 failed - check API connectivity and credentials.{Colors.RESET}")

    return results


if __name__ == "__main__":
    print("Starting LLM debug test...", flush=True)
    asyncio.run(test_step_by_step())
