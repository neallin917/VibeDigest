# Backend Architecture Cleanup Plan

> **Status**: 🔄 **In Progress**  
> **Created**: 2026-01-18  
> **Purpose**: Document backend cleanup and refactoring steps

---

## 1. Current Issues Identified

### 1.1 Duplicate Pipeline Implementations
- `main.py` contains `run_pipeline()` function (lines 549-601)
- `service.py` contains `run_pipeline()` function (lines 30-75)
- Both have similar but slightly different implementations

### 1.2 Scattered Dependencies
- `workflow.py` instantiates its own DBClient and processors
- `main.py` also instantiates the same components
- `tools.py` instantiates another set of components
- This leads to potential state inconsistencies

### 1.3 Unused LangGraph Chat Module
- `agent/chat_graph.py` - LangGraph ReAct agent (not working)
- `routers/threads.py` - Thread management endpoints (not integrated)
- These should be removed in favor of AI SDK approach

### 1.4 Missing Endpoints
- No `/api/preview-video` endpoint in Python backend
- Tools expect this endpoint to exist

---

## 2. Cleanup Actions Required

### 2.1 Remove Duplicate Code
```bash
# Remove service.py run_pipeline (keep main.py version)
rm backend/service.py

# Or consolidate into a shared module
mv backend/service.py backend/shared/pipeline_service.py
```

### 2.2 Remove LangGraph Chat Module
```bash
# Remove unused chat components
rm -rf backend/agent/
rm backend/routers/threads.py
```

### 2.3 Add Missing Endpoints
```python
# Add to main.py
@app.post("/api/preview-video")
async def preview_video(url: str = Form(...)):
    """Get video metadata without full processing."""
    info = await video_processor.extract_info_only(url)
    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "author": info.get("author"),
        "url": url
    }
```

### 2.4 Consolidate Dependencies
```python
# Create shared dependency injection
# backend/dependencies.py
class VideoProcessorDependency:
    def __init__(self):
        self.video_processor = VideoProcessor()
        self.transcriber = Transcriber()
        self.summarizer = Summarizer()
        self.db_client = DBClient()

# Use in main.py and workflow.py
from dependencies import VideoProcessorDependency
deps = VideoProcessorDependency()
```

---

## 3. File Changes Required

### 3.1 Files Removed ✅
- [x] `backend/service.py` (duplicate pipeline) - **REMOVED**
- [x] `backend/agent/chat_graph.py` (unused LangGraph agent) - **REMOVED**
- [x] `backend/routers/threads.py` (unused thread endpoints) - **REMOVED**
- [x] `backend/tools.py` (replaced by frontend tools) - **REMOVED**

### 3.2 Files Modified ✅
- [x] `backend/main.py` (add preview endpoint, remove duplicate imports) - **UPDATED**
- [ ] `backend/workflow.py` (use shared dependencies) - **PENDING**
- [ ] `backend/dependencies.py` (add shared dependency injection) - **PENDING**

### 3.3 Files Added ✅
- [x] `backend/` - Added preview endpoint in main.py directly - **DONE**
- [x] `frontend/src/app/api/chat/route.ts` - Added AI SDK tools - **DONE**
- [x] `frontend/src/components/chat/ChatContainer.tsx` - Simplified to use tools - **DONE**

---

## 4. Implementation Order

### Phase 1: Add Missing Endpoints ✅
1. [x] Add `/api/preview-video` endpoint to `main.py` - **DONE**
2. [x] Test with frontend tools - **DONE (basic structure)**

### Phase 2: Remove Unused Code ✅
1. [x] Remove `agent/` directory - **DONE**
2. [x] Remove `routers/threads.py` - **DONE**
3. [x] Remove `service.py` - **DONE**

### Phase 3: Consolidate Dependencies ⏳
1. [ ] Create shared dependency injection
2. [ ] Update `main.py` and `workflow.py`
3. [ ] Test all functionality

### Phase 4: Cleanup Imports ⏳
1. [ ] Remove unused imports
2. [ ] Fix any remaining LSP errors
3. [x] Update documentation - **DONE**

---

## 5. Testing Checklist

### 5.1 Core Functionality
- [ ] Video processing still works
- [ ] Task creation works
- [ ] Status updates work
- [ ] Preview endpoint works

### 5.2 Chat Integration
- [ ] Frontend can call preview endpoint
- [ ] Frontend can create tasks
- [ ] Frontend can query task status
- [ ] Frontend can get task outputs

### 5.3 Error Handling
- [ ] Invalid URLs handled gracefully
- [ ] Missing tasks return proper errors
- [ ] Auth failures return 401

---

## 6. Rollback Plan

If anything breaks:
1. Git revert to pre-cleanup commit
2. Restore files from backup
3. Test core functionality
4. Address issues individually

---

## 7. Success Metrics

- [ ] No duplicate code
- [ ] All tests pass
- [ ] LSP errors resolved
- [ ] Chat functionality works end-to-end
- [ ] Backend starts without errors