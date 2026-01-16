import logging
from typing import Literal
import langgraph
from importlib.metadata import version

logger = logging.getLogger(__name__)
try:
    logger.info(f"LangChain Version: {version('langchain')}")
    logger.info(f"LangGraph Version: {version('langgraph')}")
except Exception as e:
    logger.warning(f"Could not read versions: {e}")

from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent


# --- CUSTOM WRAPPER START ---
from typing import List, Any
from langchain_core.messages import BaseMessage, convert_to_messages

class SanitizedChatOpenAI(ChatOpenAI):
    """
    A wrapper around ChatOpenAI that ensures input messages are 
    correctly typed using standard LangChain utilities.
    
    It handles cases where upstream systems (like LangServe) deserialized 
    messages into generic BaseMessage objects by:
    1. Converting them back to dictionaries.
    2. Using `convert_to_messages` to instantiate the correct specific classes (HumanMessage, etc.).
    """
    def _sanitize_messages(self, messages: List[BaseMessage]) -> List[BaseMessage]:
        # Optimize: Only convert if we detect generic BaseMessage types
        if any(type(m) is BaseMessage for m in messages):
            # Convert generic messages to dicts so convert_to_messages recognizes the 'type' field
            # and instantiates the correct class.
            message_dicts = [
                m.model_dump() if type(m) is BaseMessage else m 
                for m in messages
            ]
            return convert_to_messages(message_dicts)
        return messages

    def invoke(self, input: Any, config=None, **kwargs):
        if isinstance(input, list):
            input = self._sanitize_messages(input)
        return super().invoke(input, config=config, **kwargs)

    async def ainvoke(self, input: Any, config=None, **kwargs):
        if isinstance(input, list):
            input = self._sanitize_messages(input)
        return await super().ainvoke(input, config=config, **kwargs)
# --- CUSTOM WRAPPER END ---

from config import settings
from db_client import DBClient
from tools import get_tools_list

logger = logging.getLogger(__name__)

# Initialize dependencies
model_name = settings.OPENAI_MODEL or "gpt-4o"
# Use the Sanitized wrapper instead of raw ChatOpenAI
llm = SanitizedChatOpenAI(model=model_name, temperature=0, streaming=True)

# Tools
tools = get_tools_list()

# System Prompt
system_prompt = (
    "You are VibeDigest Assistant, an agentic AI helper. "
    "Your goal is to help users process videos (download, transcribe, summarize) and answer questions about them.\n"
    "You have access to tools: 'preview_video' (to check metadata) and 'create_processing_task' (to start the workflow).\n"
    "ALWAYS preview the video first before confirming processing, unless the user explicitly confirms.\n"
    "When a task is started, you will receive a task_id. "
    "If a processing task is active or completed, use the context provided to answer questions."
)

# Create the Graph
# NOTE: The LangGraph Server automatically manages persistence (checkpointing)
# via the POSTGRES_URI environment variable. We do NOT need to manually create
# AsyncConnectionPool or AsyncPostgresSaver here - that would cause 
# "AsyncConnectionPool open with no running loop" errors at module import time.

graph = create_react_agent(
    llm, 
    tools=tools, 
    prompt=system_prompt,
)
