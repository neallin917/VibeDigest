import sys
import os
import asyncio
from dotenv import load_dotenv

# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load .env explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from config import settings
from utils.openai_client import create_chat_model

def verify_config():
    print("\n=== 1. Checking Configuration Loading ===")
    print(f"LLM_PROVIDER: {settings.LLM_PROVIDER}")
    print(f"MODEL_ALIAS_SMART: {settings.MODEL_ALIAS_SMART}")
    print(f"MODEL_ALIAS_FAST:  {settings.MODEL_ALIAS_FAST}")
    print(f"DEFAULT_TEMPERATURE:   {settings.DEFAULT_TEMPERATURE}")
    print(f"REASONING_TEMPERATURE: {settings.REASONING_TEMPERATURE}")
    print(f".env Mapping Check: {'OK' if 'gemini' in settings.MODEL_ALIAS_SMART else 'WARN: Not using Gemini?'}")

def verify_factory_logic():
    print("\n=== 2. Checking Factory Routing & Temperature ===")
    
    # Test Smart Model Creation
    smart_name = settings.MODEL_ALIAS_SMART
    temp_smart = settings.get_temperature(smart_name)
    print(f"Smart Model ('{smart_name}') -> Temp Should Be: {settings.REASONING_TEMPERATURE} -> Actual Config: {temp_smart}")
    
    try:
        model_smart = create_chat_model(smart_name)
        actual_temp = getattr(model_smart, 'temperature', 'N/A')
        print(f"  [SUCCESS] Created Smart Client. Instance Temp: {actual_temp}")
    except Exception as e:
        print(f"  [FAIL] Could not create Smart Client: {e}")

    # Test Fast Model Creation
    fast_name = settings.MODEL_ALIAS_FAST
    temp_fast = settings.get_temperature(fast_name)
    print(f"Fast Model  ('{fast_name}') -> Temp Should Be: {settings.DEFAULT_TEMPERATURE} -> Actual Config: {temp_fast}")
    
    try:
        model_fast = create_chat_model(fast_name)
        actual_temp = getattr(model_fast, 'temperature', 'N/A')
        print(f"  [SUCCESS] Created Fast Client.  Instance Temp: {actual_temp}")
    except Exception as e:
        print(f"  [FAIL] Could not create Fast Client: {e}")

async def verify_connection():
    print("\n=== 3. Real-World Connection Test (Dry Run) ===")
    print("Attempting to send 'Hello' to FAST model...")
    try:
        model = create_chat_model(settings.MODEL_ALIAS_FAST)
        # Simple invoke
        response = model.invoke("Hello, are you operational?")
        print(f"  [SUCCESS] Response: {response.content[:50]}...")
    except Exception as e:
        print(f"  [FAIL] Connection failed: {e}")
        print("  Check your OPENAI_BASE_URL and OPENAI_API_KEY in .env")

if __name__ == "__main__":
    verify_config()
    verify_factory_logic()
    # verify_connection is async, simple check:
    # prompt user to run connection test?
    if len(sys.argv) > 1 and sys.argv[1] == "--connect":
        import asyncio
        asyncio.run(verify_connection())
    else:
        print("\n(Run with --connect to perform actual API call)")
