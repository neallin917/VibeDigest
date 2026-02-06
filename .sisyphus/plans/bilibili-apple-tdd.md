# Bilibili & Apple Podcast TDD Integration Tests

## TL;DR

> **Quick Summary**: Write TDD test cases to validate VibeDigest's full pipeline support for Bilibili and Apple Podcast URLs — including download, Whisper transcription, and summarization — without modifying production code.
> 
> **Deliverables**:
> - `backend/tests/test_bilibili_apple_integration.py` with 8+ test cases
> - Zero token consumption (all LLM calls mocked)
> - TDD-compliant structure (tests written to fail first, validate existing behavior)
> 
> **Estimated Effort**: Short (1-2 hours)
> **Parallel Execution**: NO - sequential (TDD requires RED → GREEN → REFACTOR cycle)
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request
Write TDD test cases to verify that VibeDigest correctly handles Bilibili and Apple Podcast URLs through the full pipeline (download → transcribe → summarize), without modifying any production code.

### Test URLs
- **Bilibili**: `https://www.bilibili.com/video/BV1vizZBHEhS/?spm_id_from=333.1007.tianma.1-3-3.click`
- **Apple Podcast**: `https://podcasts.apple.com/cn/podcast/vol-004-对话郭山汕-不入江湖-但要继续赢/id1862365307?i=1000748467496`

### Research Findings

**Core Files (from previous session analysis)**:
- `backend/workflow.py` (969 lines): LangGraph workflow with nodes `check_cache`, `fetch_data`, `transcribe`, `summarize`, `classify`
- `backend/services/video_processor.py` (773 lines): yt-dlp download, `_enrich_bilibili`, `_enrich_apple` methods
- `backend/utils/url.py` (94 lines): URL normalization logic

**Existing Test Patterns** (from `test_workflow_mock.py`):
```python
# Direct patch of workflow module globals
workflow.db_client = MagicMock()
workflow.supadata_client = AsyncMock()
workflow.video_processor = AsyncMock()
workflow.transcriber = AsyncMock()
workflow.summarizer = MagicMock()

# State construction
cast(VideoProcessingState, {...})
```

**Existing Coverage Gaps**:
- ✅ `test_enrich_bilibili` exists but only tests metadata enrichment (mocked)
- ✅ `test_enrich_apple` exists but only tests metadata enrichment (mocked)
- ❌ **Missing**: Full pipeline integration tests with specific URLs
- ❌ **Missing**: URL normalization tests for these specific URLs
- ❌ **Missing**: Verification that non-YouTube paths use Whisper

---

## Work Objectives

### Core Objective
Create a comprehensive TDD test suite that validates Bilibili and Apple Podcast support through the entire VibeDigest pipeline, ensuring these platforms correctly bypass YouTube-specific code paths and use Whisper for transcription.

### Concrete Deliverables
- `backend/tests/test_bilibili_apple_integration.py` (~150-200 lines)
- All tests pass with `pytest backend/tests/test_bilibili_apple_integration.py`

### Definition of Done
- [ ] All 8 test cases exist and execute without errors
- [ ] Zero real API calls (OpenAI, yt-dlp network) during test execution
- [ ] Tests follow project's mocking patterns (from `test_workflow_mock.py`)
- [ ] `pytest backend/tests/test_bilibili_apple_integration.py -v` shows all GREEN

### Must Have
- URL normalization tests for both platforms
- `is_youtube` detection tests (must return `False` for both)
- Full pipeline mocked tests verifying Whisper path
- `@pytest.mark.network` decorator for optional real network tests

### Must NOT Have (Guardrails)
- ❌ Real OpenAI API calls (violates zero-token policy)
- ❌ Real video downloads during unit tests
- ❌ Modifications to production code (`workflow.py`, `video_processor.py`, etc.)
- ❌ New dependencies in `requirements.txt`
- ❌ Hard-coded API keys or secrets in test files

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (pytest + conftest.py already configured)
- **Automated tests**: YES (this IS the test creation task)
- **Framework**: pytest (existing)

### Agent-Executed QA Scenarios (MANDATORY)

**Primary Verification**: Run pytest and capture output

```
Scenario: All new tests pass
  Tool: Bash (pytest)
  Preconditions: Backend dependencies installed, in backend/ directory
  Steps:
    1. cd /Volumes/ssd/AI-Video-Transcriber/backend
    2. uv run pytest tests/test_bilibili_apple_integration.py -v --tb=short
    3. Assert: Exit code is 0
    4. Assert: Output contains "8 passed" (or total test count)
    5. Assert: No "FAILED" in output
    6. Assert: No "ERROR" in output
  Expected Result: All tests pass
  Evidence: Terminal output captured to .sisyphus/evidence/task-4-pytest-all-pass.txt

Scenario: Tests don't make real network calls
  Tool: Bash (pytest with network isolation)
  Preconditions: Tests written with proper mocking
  Steps:
    1. cd /Volumes/ssd/AI-Video-Transcriber/backend
    2. uv run pytest tests/test_bilibili_apple_integration.py -v -m "not network"
    3. Assert: Exit code is 0
    4. Assert: Tests complete in < 5 seconds (no real downloads)
  Expected Result: Fast execution, no network calls
  Evidence: Timing captured
```

---

## Execution Strategy

### Sequential Execution (TDD Requires Order)

```
Task 1: Setup test file structure
    ↓
Task 2: Write URL normalization tests (Layer 1)
    ↓
Task 3: Write platform detection tests (Layer 1)
    ↓
Task 4: Write full pipeline mocked tests (Layer 2)
    ↓
Task 5: (Optional) Write network integration tests (Layer 3)
```

### Dependency Matrix

| Task | Depends On | Blocks | Parallel? |
|------|------------|--------|-----------|
| 1 | None | 2, 3, 4 | No (first) |
| 2 | 1 | 4 | No |
| 3 | 1 | 4 | Could run with 2, but TDD prefers sequential |
| 4 | 2, 3 | 5 | No |
| 5 | 4 | None | No (optional) |

---

## TODOs

- [ ] 1. Create test file skeleton with imports and fixtures

  **What to do**:
  - Create `backend/tests/test_bilibili_apple_integration.py`
  - Import pytest, unittest.mock (MagicMock, AsyncMock, patch)
  - Import project modules: `workflow`, `VideoProcessingState`, URL utilities
  - Define test constants for Bilibili/Apple URLs
  - Add pytest markers for `network` tests

  **Must NOT do**:
  - Do not add new dependencies
  - Do not import from external packages not in requirements.txt

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file creation with boilerplate
  - **Skills**: [`test-driven-development`, `python-patterns`]
    - `test-driven-development`: TDD structure expertise
    - `python-patterns`: Python testing best practices

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None (first task)

  **References**:
  
  **Pattern References**:
  - `backend/tests/test_workflow_mock.py:1-30` - Import structure and fixture patterns
  - `backend/tests/conftest.py:1-50` - Existing pytest fixtures
  
  **Test References**:
  - `backend/tests/test_platform_support.py:1-20` - Platform test structure

  **Acceptance Criteria**:
  - [ ] File exists: `backend/tests/test_bilibili_apple_integration.py`
  - [ ] File imports: `pytest`, `MagicMock`, `AsyncMock`, `patch`
  - [ ] File imports: `from workflow import VideoProcessingState`
  - [ ] Constants defined: `BILIBILI_URL`, `APPLE_URL` with actual test URLs
  - [ ] pytest marker defined: `pytestmark = pytest.mark.asyncio` if async tests
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py --collect-only` shows 0 tests (skeleton only)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Test file structure is valid
    Tool: Bash
    Preconditions: None
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run python -c "import tests.test_bilibili_apple_integration"
      3. Assert: Exit code is 0 (no import errors)
    Expected Result: Module imports without errors
    Evidence: Terminal output

  Scenario: Pytest discovers file
    Tool: Bash
    Preconditions: File created
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run pytest tests/test_bilibili_apple_integration.py --collect-only
      3. Assert: Output shows "0 tests collected" or lists test names if any exist
    Expected Result: Pytest recognizes the file
    Evidence: Terminal output captured
  ```

  **Commit**: NO (group with Task 2)

---

- [ ] 2. Write URL normalization tests (Layer 1 - Unit)

  **What to do**:
  - `test_url_normalization_bilibili`: Verify `spm_id_from` parameter is stripped
    - Input: Full Bilibili URL with `spm_id_from=...`
    - Expected: URL without tracking parameters
  - `test_url_normalization_apple`: Verify Apple URL structure is preserved
    - Input: Full Apple Podcast URL with `i=...` parameter
    - Expected: URL preserves `i=` parameter (episode identifier)
  - Use `from utils.url import normalize_url` (or equivalent)

  **Must NOT do**:
  - Do not test URL parsing logic that doesn't exist
  - Do not create new utility functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple unit tests, no complex logic
  - **Skills**: [`test-driven-development`, `python-patterns`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `backend/utils/url.py:1-94` - URL normalization implementation (MUST READ to understand existing API)
  
  **Test References**:
  - `backend/tests/test_url_utils.py` - Existing URL tests (if any) for pattern reference

  **Acceptance Criteria**:
  - [ ] `test_url_normalization_bilibili` exists and tests spm_id_from removal
  - [ ] `test_url_normalization_apple` exists and tests i= parameter preservation
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py::test_url_normalization_bilibili -v` → PASS
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py::test_url_normalization_apple -v` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: URL normalization tests pass
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run pytest tests/test_bilibili_apple_integration.py -k "normalization" -v
      3. Assert: Exit code is 0
      4. Assert: Output contains "2 passed"
    Expected Result: Both normalization tests pass
    Evidence: .sisyphus/evidence/task-2-url-normalization.txt

  Scenario: Tests use actual URLs from requirements
    Tool: Bash
    Preconditions: Tests written
    Steps:
      1. grep -q "BV1vizZBHEhS" backend/tests/test_bilibili_apple_integration.py
      2. grep -q "id1862365307" backend/tests/test_bilibili_apple_integration.py
      3. Assert: Both greps return 0
    Expected Result: Test file contains specified URLs
    Evidence: Grep output
  ```

  **Commit**: YES
  - Message: `test(integration): add URL normalization tests for Bilibili and Apple Podcast`
  - Files: `backend/tests/test_bilibili_apple_integration.py`
  - Pre-commit: `uv run pytest tests/test_bilibili_apple_integration.py -k "normalization" -v`

---

- [ ] 3. Write platform detection tests (Layer 1 - Unit)

  **What to do**:
  - `test_bilibili_is_not_youtube`: Verify `is_youtube()` returns `False` for Bilibili URL
  - `test_apple_is_not_youtube`: Verify `is_youtube()` returns `False` for Apple URL
  - `test_bilibili_platform_detection`: Verify platform is detected as "bilibili"
  - `test_apple_platform_detection`: Verify platform is detected as "apple" or "podcast"
  - Use existing detection functions from `utils/url.py` or `video_processor.py`

  **Must NOT do**:
  - Do not assume detection functions exist without checking
  - If functions don't exist, test the indirect behavior (workflow routing)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple unit tests
  - **Skills**: [`test-driven-development`, `python-patterns`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential  
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `backend/utils/url.py` - Check for `is_youtube()` function
  - `backend/services/video_processor.py:_enrich_bilibili` - Platform-specific enrichment
  - `backend/workflow.py:fetch_data` - Check how YouTube detection is used

  **Acceptance Criteria**:
  - [ ] `test_bilibili_is_not_youtube` exists and returns False
  - [ ] `test_apple_is_not_youtube` exists and returns False
  - [ ] Platform detection tests exist (if platform detection API exists)
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py -k "youtube" -v` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Platform detection tests pass
    Tool: Bash
    Preconditions: Task 2 complete
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run pytest tests/test_bilibili_apple_integration.py -k "youtube or platform" -v
      3. Assert: Exit code is 0
      4. Assert: Output contains "passed" (at least 2)
    Expected Result: Platform detection tests pass
    Evidence: .sisyphus/evidence/task-3-platform-detection.txt
  ```

  **Commit**: YES
  - Message: `test(integration): add platform detection tests for Bilibili and Apple`
  - Files: `backend/tests/test_bilibili_apple_integration.py`
  - Pre-commit: `uv run pytest tests/test_bilibili_apple_integration.py -k "youtube or platform" -v`

---

- [ ] 4. Write full pipeline mocked tests (Layer 2 - Integration)

  **What to do**:
  - `test_bilibili_full_pipeline_uses_whisper`: 
    - Mock all external dependencies (db_client, video_processor, transcriber, summarizer)
    - Invoke workflow with Bilibili URL
    - Assert: `transcriber.transcribe` was called (Whisper path)
    - Assert: `supadata_client` was NOT called (YouTube-only)
  - `test_apple_full_pipeline_uses_whisper`:
    - Same structure as Bilibili test
    - Verify Apple Podcast uses Whisper path
  - Follow mocking pattern from `test_workflow_mock.py`:
    ```python
    workflow.db_client = MagicMock()
    workflow.transcriber = AsyncMock()
    # etc.
    ```

  **Must NOT do**:
  - Do not call real OpenAI API
  - Do not download real videos
  - Do not modify workflow.py

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex mocking setup, requires understanding workflow internals
  - **Skills**: [`test-driven-development`, `python-patterns`]
    - `test-driven-development`: TDD integration patterns
    - `python-patterns`: AsyncMock, MagicMock expertise

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `backend/tests/test_workflow_mock.py:50-164` - CRITICAL: Full workflow mocking pattern
  - `backend/tests/test_platform_support.py:test_ingest_whisper_fallback` - Whisper path verification pattern
  - `backend/workflow.py:fetch_data` - Node that decides Supadata vs Whisper
  - `backend/workflow.py:transcribe` - Node that calls Whisper

  **Type References**:
  - `backend/workflow.py:VideoProcessingState` - State type definition

  **Acceptance Criteria**:
  - [ ] `test_bilibili_full_pipeline_uses_whisper` exists
  - [ ] `test_apple_full_pipeline_uses_whisper` exists
  - [ ] Both tests mock: `db_client`, `video_processor`, `transcriber`, `summarizer`, `supadata_client`
  - [ ] Tests verify `transcriber.transcribe.called == True`
  - [ ] Tests verify Supadata NOT called for non-YouTube URLs
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py -k "pipeline" -v` → PASS
  - [ ] Tests complete in < 5 seconds (no real network calls)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full pipeline tests pass with mocking
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run pytest tests/test_bilibili_apple_integration.py -k "pipeline" -v --tb=short
      3. Assert: Exit code is 0
      4. Assert: Output contains "2 passed"
      5. Assert: Execution time < 5 seconds
    Expected Result: Pipeline tests pass quickly (mocked)
    Evidence: .sisyphus/evidence/task-4-pipeline-tests.txt

  Scenario: No real API calls made
    Tool: Bash
    Preconditions: Tests exist
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. OPENAI_API_KEY="" uv run pytest tests/test_bilibili_apple_integration.py -k "pipeline" -v 2>&1
      3. Assert: Exit code is 0 (tests pass even without real API key)
    Expected Result: Tests don't require real API keys
    Evidence: Terminal output
  ```

  **Commit**: YES
  - Message: `test(integration): add full pipeline mocked tests for Bilibili and Apple Podcast`
  - Files: `backend/tests/test_bilibili_apple_integration.py`
  - Pre-commit: `uv run pytest tests/test_bilibili_apple_integration.py -v`

---

- [ ] 5. (Optional) Add network integration tests (Layer 3)

  **What to do**:
  - `test_bilibili_metadata_extraction_real`: 
    - Mark with `@pytest.mark.network`
    - Call real yt-dlp to extract Bilibili metadata
    - Assert: Returns title, thumbnail, duration
  - `test_apple_metadata_extraction_real`:
    - Mark with `@pytest.mark.network`
    - Call real yt-dlp to extract Apple metadata
    - Assert: Returns title, audio URL
  - These tests are OPTIONAL and skipped by default

  **Must NOT do**:
  - Do not run these in CI (network unreliable)
  - Do not call OpenAI (only yt-dlp metadata is allowed)
  - Do not download full videos (metadata only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple network tests, optional
  - **Skills**: [`test-driven-development`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final)
  - **Blocks**: None
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `backend/services/video_processor.py:_extract_video_info` - How yt-dlp is called
  - `backend/tests/conftest.py` - Check for existing network markers

  **Acceptance Criteria**:
  - [ ] Tests marked with `@pytest.mark.network`
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py -m "not network" -v` → Skips network tests
  - [ ] `uv run pytest tests/test_bilibili_apple_integration.py -m "network" -v` → Runs only network tests
  - [ ] Network tests complete in < 30 seconds each

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Network tests are skipped by default marker
    Tool: Bash
    Preconditions: Task 4 complete
    Steps:
      1. cd /Volumes/ssd/AI-Video-Transcriber/backend
      2. uv run pytest tests/test_bilibili_apple_integration.py -m "not network" -v
      3. Assert: Network tests show "skipped" or don't appear
      4. Assert: Other tests pass
    Expected Result: Network tests isolated
    Evidence: .sisyphus/evidence/task-5-network-skip.txt
  ```

  **Commit**: YES
  - Message: `test(integration): add optional network tests for Bilibili and Apple metadata`
  - Files: `backend/tests/test_bilibili_apple_integration.py`
  - Pre-commit: `uv run pytest tests/test_bilibili_apple_integration.py -m "not network" -v`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `test(integration): add URL normalization tests for Bilibili and Apple Podcast` | `backend/tests/test_bilibili_apple_integration.py` | `pytest -k "normalization"` |
| 3 | `test(integration): add platform detection tests for Bilibili and Apple` | `backend/tests/test_bilibili_apple_integration.py` | `pytest -k "youtube or platform"` |
| 4 | `test(integration): add full pipeline mocked tests for Bilibili and Apple Podcast` | `backend/tests/test_bilibili_apple_integration.py` | `pytest -v` all pass |
| 5 | `test(integration): add optional network tests for Bilibili and Apple metadata` | `backend/tests/test_bilibili_apple_integration.py` | `pytest -m "not network"` |

---

## Success Criteria

### Verification Commands
```bash
cd /Volumes/ssd/AI-Video-Transcriber/backend

# All tests pass
uv run pytest tests/test_bilibili_apple_integration.py -v

# Tests are fast (no real network)
time uv run pytest tests/test_bilibili_apple_integration.py -m "not network"
# Expected: < 10 seconds

# No real API keys needed
OPENAI_API_KEY="" uv run pytest tests/test_bilibili_apple_integration.py -m "not network" -v
# Expected: All pass
```

### Final Checklist
- [ ] 8+ test cases exist in `test_bilibili_apple_integration.py`
- [ ] All tests pass with `pytest -v`
- [ ] Zero token consumption (mocked LLM calls)
- [ ] Network tests properly isolated with `@pytest.mark.network`
- [ ] Follows existing project test patterns
- [ ] No production code modified
