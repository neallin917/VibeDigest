import pytest
import asyncio
import json
from comprehension import ComprehensionAgent
from pydantic import ValidationError

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
