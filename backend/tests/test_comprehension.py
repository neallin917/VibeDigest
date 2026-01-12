import pytest
import asyncio
import json
from comprehension import ComprehensionAgent
from pydantic import ValidationError
from unittest.mock import MagicMock, AsyncMock, patch

@pytest.mark.asyncio
async def test_generate_comprehension_brief():
    agent = ComprehensionAgent()
    transcript = """
    In this video, we are going to talk about the future of AI. 
    AI is moving from narrow tasks to general reasoning. 
    The core problem is that current models are still "stochastic parrots" without true understanding. 
    The speaker's position is that we need a new architecture, perhaps neuro-symbolic, to reach AGI.
    Key insights: 
    1. Scaling laws are hitting diminishing returns. 
    2. Data quality is more important than quantity now.
    3. Reasoning requires a world model, not just text prediction.
    Ignore the 5-minute sponsor segment about NordVPN at the beginning.
    This is for AI researchers and engineers. Not for casual tech fans.
    Takeaway: Always ask if your model has a world model or just a grammar model.
    """
    
    
    # Mock response data that satisfies all assertions
    mock_data = {
        "core_intent": "Test intent",
        "core_position": "Test position",
        "key_insights": [
            {"title": "Constraint 1", "new_perspective": "Perspective 1", "why_it_matters": "Reason 1"},
            {"title": "Constraint 2", "new_perspective": "Perspective 2", "why_it_matters": "Reason 2"},
            {"title": "Constraint 3", "new_perspective": "Perspective 3", "why_it_matters": "Reason 3"}
        ],
        "what_to_ignore": ["Sponsors"],
        "target_audience": {
            "who_benefits": ["Researchers"],
            "who_wont": ["Casual fans"]
        },
        "reusable_takeaway": "Test takeaway"
    }

    # Create a mock for the structured LLM result
    # The ainvoke method needs to return an object that has a model_dump_json method
    # or be the Pydantic model itself. 
    # Since the code calls `brief_obj.model_dump_json()`, we need to mock that.
    
    mock_brief_obj = MagicMock()
    mock_brief_obj.model_dump_json.return_value = json.dumps(mock_data)
    
    # Mock the LLM chain
    mock_structured_llm = MagicMock()
    mock_structured_llm.ainvoke = AsyncMock(return_value=mock_brief_obj)

    mock_llm = MagicMock()
    mock_llm.with_structured_output.return_value = mock_structured_llm

    # Patch _get_llm to return our mock_llm
    with patch.object(agent, '_get_llm', return_value=mock_llm):
        # Test zh
        brief_zh = await agent.generate_comprehension_brief(transcript, target_language="zh")
        assert brief_zh is not None
        data_zh = json.loads(brief_zh)
        assert "core_intent" in data_zh
        assert "core_position" in data_zh
        assert "key_insights" in data_zh
        assert len(data_zh["key_insights"]) >= 3
        assert "title" in data_zh["key_insights"][0]
        assert "new_perspective" in data_zh["key_insights"][0]

        # Test en
        brief_en = await agent.generate_comprehension_brief(transcript, target_language="en")
        assert brief_en is not None
        data_en = json.loads(brief_en)
        assert "core_intent" in data_en
        assert "reusable_takeaway" in data_en
        assert isinstance(data_en["what_to_ignore"], list)

if __name__ == "__main__":
    asyncio.run(test_generate_comprehension_brief())
