import sys
import os
import asyncio

# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from utils.env_loader import load_env  # noqa: E402
load_env()

from config import settings  # noqa: E402
from utils.openai_client import create_chat_model  # noqa: E402

def verify_config():
    from utils.model_registry import get_model_registry
    registry = get_model_registry()
    provider_cfg = registry.get_provider(settings.LLM_PROVIDER)
    defaults = provider_cfg.get("defaults", {}) if provider_cfg else {}
    resolved_smart = defaults.get("smart") or settings.MODEL_ALIAS_SMART
    resolved_fast = defaults.get("fast") or settings.MODEL_ALIAS_FAST

    print("\n=== 1. Checking Configuration Loading ===")
    print(f"LLM_PROVIDER: {settings.LLM_PROVIDER}")
    print(f"MODEL_ALIAS_SMART (Env): {settings.MODEL_ALIAS_SMART}")
    print(f"MODEL_ALIAS_FAST  (Env): {settings.MODEL_ALIAS_FAST}")
    print(f"Resolved Smart Model:   {resolved_smart}")
    print(f"Resolved Fast Model:    {resolved_fast}")
    print(f"DEFAULT_TEMPERATURE:   {settings.DEFAULT_TEMPERATURE}")
    print(f"REASONING_TEMPERATURE: {settings.REASONING_TEMPERATURE}")
    
    mapping_check = "OK" if resolved_smart and ("gemini" in resolved_smart or "gpt-4o" in resolved_smart) else "WARN"
    print(f"Mapping Check: {mapping_check}")

def verify_factory_logic():
    print("\n=== 2. Checking Factory Routing & Temperature ===")
    from utils.model_registry import get_model_registry
    registry = get_model_registry()
    provider_cfg = registry.get_provider(settings.LLM_PROVIDER)
    defaults = provider_cfg.get("defaults", {}) if provider_cfg else {}
    
    # Test Smart Model Creation
    smart_name_raw = defaults.get("smart") or settings.MODEL_ALIAS_SMART or "gpt-4o"
    smart_name = str(smart_name_raw)
    temp_smart = settings.get_temperature(smart_name)
    print(f"Smart Model ('{smart_name}') -> Temp Should Be: {settings.REASONING_TEMPERATURE} -> Actual Config: {temp_smart}")
    
    try:
        model_smart = create_chat_model(smart_name)
        actual_temp = getattr(model_smart, 'temperature', 'N/A')
        print(f"  [SUCCESS] Created Smart Client. Instance Temp: {actual_temp}")
    except Exception as e:
        print(f"  [FAIL] Could not create Smart Client: {e}")

    # Test Fast Model Creation
    fast_name_raw = defaults.get("fast") or settings.MODEL_ALIAS_FAST or "gpt-4o-mini"
    fast_name = str(fast_name_raw)
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
    from utils.model_registry import get_model_registry
    registry = get_model_registry()
    
    # FOR TESTING: Force custom provider if requested
    is_custom_test = settings.LLM_PROVIDER == "custom"
    
    provider_cfg = registry.get_provider(settings.LLM_PROVIDER)
    defaults = provider_cfg.get("defaults", {}) if provider_cfg else {}
    fast_model = defaults.get("fast") or settings.MODEL_ALIAS_FAST
    
    if not fast_model:
        print("  [FAIL] No FAST model resolved. Check your configuration.")
        return

    # Ensure model has clean string type
    model_to_test = str(fast_model)

    test_kwargs = {}
    if is_custom_test:
        should_inject = False
        current_key = os.getenv("OPENAI_API_KEY") or ""
        current_base = os.getenv("OPENAI_BASE_URL") or ""
        
        if "host.docker.internal" in current_base:
            print(f"  [INFO] Detected Docker hostname in Base URL: {current_base}")
            print("  [INFO] Swapping to '127.0.0.1' for local verification...")
            current_base = current_base.replace("host.docker.internal", "127.0.0.1")
            settings.OPENAI_BASE_URL = current_base
            test_kwargs["api_base"] = current_base
            if current_key:
                test_kwargs["api_key"] = current_key

        if not current_key:
            should_inject = True
        elif "sk-proj" in current_key:
            should_inject = True
        elif not current_base or "api.openai.com" in current_base:
            should_inject = True

        if should_inject:
            print("  [INFO] Injecting Custom Test Credentials (127.0.0.1:8045)...")
            settings.OPENAI_API_KEY = "sk-f1b15d7740df413bab703f490e2faf04"
            settings.OPENAI_BASE_URL = "http://127.0.0.1:8045/v1"
            test_kwargs["api_key"] = settings.OPENAI_API_KEY
            test_kwargs["api_base"] = settings.OPENAI_BASE_URL


    print(f"Attempting to send 'Hello' to model: {model_to_test} (Provider: {settings.LLM_PROVIDER})...")
    try:
        model = create_chat_model(model_to_test, **test_kwargs)
        # Simple invoke
        response = await model.ainvoke("Hello, are you operational?")
        print(f"  [SUCCESS] Response: {response.content[:50]}...")
    except Exception as e:
        print(f"  [FAIL] Connection failed: {e}")
        api_key_env = provider_cfg.get('api_key_env') if provider_cfg else "OPENAI_API_KEY"
        base_url_env = provider_cfg.get('base_url_env') if provider_cfg else "OPENAI_BASE_URL"
        print(f"  Check your {api_key_env} and {base_url_env} in .env")

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
