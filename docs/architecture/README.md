# Architecture Documentation

> **Last Updated**: 2026-01-18  
> **Status**: 🔄 **Transitioning from LangGraph to AI SDK**

---

## 📋 Active Architecture Documents

### 1. [Chat Architecture (AI SDK + Tools)](./chat-ai-sdk-tools.md)
**Status**: ✅ **ACTIVE** - **Recommended Implementation**

- **Overview**: Complete chat system using Vercel AI SDK v5 + Tool Calling
- **Components**: Frontend orchestration, Supabase data plane, Python compute plane
- **Key Features**: Tool-based context fetching, edge deployment, extensible design
- **Migration**: Step-by-step implementation plan included

### 2. [Backend Cleanup Plan](./backend-cleanup-plan.md)
**Status**: 🔄 **IN PROGRESS**

- **Purpose**: Remove duplicate code and unused LangGraph components
- **Actions**: Delete `service.py`, `agent/`, `routers/threads.py`
- **Outcome**: Clean, maintainable backend architecture

---

## 🗂️ Legacy Documentation (Deprecated)

### LangGraph-Based Chat Architecture
**Location**: [`docs/deprecated/legacy-chat-langgraph/`](../deprecated/legacy-chat-langgraph/)

**Status**: ❌ **DEPRECATED** - **Not Recommended**

**Reasons for Deprecation**:
- LangGraph persistence bugs and complexity
- Duplicate pipeline implementations
- Poor debugging experience
- Higher maintenance overhead

**Documents in Legacy Folder**:
- `01_product_requirements.md`
- `02_technical_architecture.md` (LangGraph approach)
- `03_api_specification.md`
- `04_database_schema.md`
- `implementation_plan.md`
- `task.md`
- `walkthrough.md`

---

## 🔄 Migration Timeline

### Phase 1: Foundation (Week 1)
- [x] Document new architecture
- [x] Move legacy docs to deprecated
- [x] Implement basic AI SDK tools
- [x] Add preview endpoint to backend

### Phase 2: Tool Integration (Week 1-2)
- [x] Implement task creation tools
- [x] Remove URL detection from frontend
- [ ] Test end-to-end chat flow
- [ ] Install missing dependencies (zod, python packages)

### Phase 3: Cleanup (Week 2)
- [x] Remove duplicate `run_pipeline` implementations
- [x] Delete unused LangGraph components
- [ ] Consolidate dependencies
- [ ] Fix remaining LSP errors

### Phase 4: Enhancement (Week 3+)
- [ ] Add advanced tools (export, analytics)
- [ ] Optimize token usage
- [ ] Add monitoring and observability
- [ ] Performance testing

---

## 📊 Architecture Comparison

| Aspect | New (AI SDK + Tools) | Legacy (LangGraph) |
|--------|---------------------|--------------------|
| **Development Speed** | ✅ Fast (leverages existing) | ❌ Slow (persistence bugs) |
| **Debugging** | ✅ Easy (Vercel logs) | ❌ Hard (LangGraph server) |
| **Tool Extensibility** | ✅ Simple (add functions) | ❌ Complex (modify graph) |
| **Deployment** | ✅ Edge-native | ❌ Python server required |
| **Maintenance** | ✅ Low (TypeScript only) | ❌ High (Python + TS) |
| **Performance** | ✅ Fast cold starts | ❌ Slower warm-up |
| **Real-time** | ✅ Native streaming | ❌ Complex SSE setup |

---

## 🎯 Next Steps

1. **Review Architecture**: Read [Chat Architecture (AI SDK + Tools)](./chat-ai-sdk-tools.md)
2. **Start Implementation**: Begin with Phase 1 tasks
3. **Track Progress**: Use this document as a checklist
4. **Update Documentation**: Keep this index current

---

## 📞 Support

For questions about the architecture transition:
- Reference the active architecture documents
- Check the implementation plan in the chat architecture doc
- Review the backend cleanup plan for code changes

**Remember**: The new AI SDK approach is recommended over the legacy LangGraph implementation.