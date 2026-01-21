import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add backend directory to sys.path to ensure we can import config and utils
# Assuming this script is in backend/scripts/
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

try:
    from config import settings
    from utils.openai_client import create_chat_model
    from langchain_core.messages import HumanMessage
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

def verify_llm():
    print("----------------------------------------------------------------")
    print("🔍 Testing LLM Connection inside Docker")
    print("----------------------------------------------------------------")
    print(f"Configuration:")
    print(f"  Provider:     {settings.LLM_PROVIDER}")
    print(f"  Base URL:     {settings.OPENAI_BASE_URL}")
    print(f"  API Key:      {settings.OPENAI_API_KEY[:5]}***" if settings.OPENAI_API_KEY else "  API Key:      None")
    print(f"  Model (Fast): {settings.MODEL_ALIAS_FAST}")
    print("----------------------------------------------------------------")

    try:
        print("🚀 Initializing Chat Model...")
        # Use a low temperature for deterministic test
        chat = create_chat_model(settings.MODEL_ALIAS_FAST, temperature=0.1)
        
        print("📨 Sending Test Message: 'Hello, verify connectivity.'")
        messages = [HumanMessage(content="Hello, verify connectivity.")]
        
        response = chat.invoke(messages)
        
        print("----------------------------------------------------------------")
        print(f"✅ Response Received:")
        print(f"{response.content}")
        print("----------------------------------------------------------------")
        print("✅ LLM Connection Successful!")
        return True

    except Exception as e:
        print("----------------------------------------------------------------")
        print(f"❌ LLM Connection Failed!")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {str(e)}")
        print("----------------------------------------------------------------")
        
        # Check for common networking issues
        if "Connection refused" in str(e):
            print("params: Connection Refused. Check if the LLM service is running and accessible at the Base URL.")
            if "host.docker.internal" in (settings.OPENAI_BASE_URL or ""):
                print("Hint: You are using host.docker.internal. Ensure usage from inside Docker works.")
        return False

if __name__ == "__main__":
    success = verify_llm()
    if not success:
        sys.exit(1)
