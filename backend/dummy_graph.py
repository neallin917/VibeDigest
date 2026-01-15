from langgraph.graph import StateGraph

def step(state):
    return state

workflow = StateGraph(dict)
workflow.add_node("step", step)
workflow.set_entry_point("step")
graph = workflow.compile()
