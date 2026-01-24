import os
import pytest
from unittest.mock import patch, MagicMock
from config import settings
from utils.openai_client import create_chat_model

class TestLLMSwitching:
    
    @patch('langchain_litellm.ChatLiteLLM')
    @patch('langchain_openai.ChatOpenAI')
    def test_provider_switching(self, mock_chat_openai, mock_chat_litellm):
        """Verify factory chooses correct class based on LLM_PROVIDER"""
        
        # Case 1: Default (OpenAI)
        with patch.object(settings, 'LLM_PROVIDER', 'openai'):
            model = create_chat_model("gpt-4o")
            mock_chat_openai.assert_called()
            mock_chat_litellm.assert_not_called()
            
        mock_chat_openai.reset_mock()
        mock_chat_litellm.reset_mock()
        
        # Case 2: Custom Provider (e.g. Ollama)
        with patch.object(settings, 'LLM_PROVIDER', 'ollama'):
            model = create_chat_model("gpt-4o")
            mock_chat_litellm.assert_called()
            mock_chat_openai.assert_not_called()

    @patch('langchain_litellm.ChatLiteLLM')
    def test_model_alias_mapping(self, mock_chat_litellm):
        """Verify aliases are passed correctly"""
        with patch.object(settings, 'LLM_PROVIDER', 'custom'):
            # Simulate config using an alias
            aliased_model = "ollama/llama3" 
            model = create_chat_model(aliased_model)
            
            mock_chat_litellm.assert_called_with(
                model=aliased_model,
                temperature=0.1
            )
