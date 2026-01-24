
import os
import sys
import logging
# Add parent dir to path to import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.utils.env_loader import load_env

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_litellm")

# Load environment variables correctly
load_env()

try:
    import litellm
except ImportError:
    logger.error("litellm not installed. Please install it.")
    sys.exit(1)

def test_connection():
    # 1. Print current configuration from environment
    provider = os.getenv("LLM_PROVIDER", "openai")
    api_key = os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")
    model_alias_fast = os.getenv("MODEL_ALIAS_FAST", "gpt-4o-mini")

    logger.info(f"--- Configuration ---")
    logger.info(f"LLM_PROVIDER: {provider}")
    logger.info(f"OPENAI_BASE_URL: {base_url}")
    # Mask API key for security in logs
    masked_key = f"{api_key[:5]}...{api_key[-5:]}" if api_key and len(api_key) > 10 else "None"
    logger.info(f"OPENAI_API_KEY: {masked_key}")
    logger.info(f"Model to test: {model_alias_fast}")
    logger.info(f"---------------------")

    # 2. Configure LiteLLM
    if provider != "openai":
         # LiteLLM needs to know it's a custom proxy if using OpenAI format
        pass
    
    # Enable debugging for more info
    litellm.set_verbose = True
    litellm.drop_params = True # As seen in utils/openai_client.py

    # 3. Make the call
    logger.info(f"Attempting completion with model: {model_alias_fast}...")
    
    try:
        response = litellm.completion(
            model=model_alias_fast,
            messages=[{"role": "user", "content": "Hello, are you working? Reply with 'Yes, I am working'."}],
            api_key=api_key,
            base_url=base_url, 
            temperature=0.1,
            max_tokens=50
        )
        
        logger.info("--- Success! ---")
        logger.info(f"Response Content: {response.choices[0].message.content}")
        logger.info(f"Model Used: {response.model}")
        
    except Exception as e:
        logger.error(f"--- Failure ---")
        logger.error(f"Error details: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_connection()
