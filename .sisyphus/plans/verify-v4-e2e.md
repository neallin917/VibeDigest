# Plan: Verify V4 Summary Engine & Chat E2E

## TL;DR

> **Quick Summary**: Verification of recent full-stack changes: Backend V4 Summary Engine (Two-Phase Logic) and Frontend Chat Container updates.
> 
> **Deliverables**:
> - Execution Report of Backend Integration Script (`test_summary_v4.py`)
> - Execution Report of Frontend Unit Tests (`ChatWorkspace.test.tsx`)
> - E2E Verification Log (Agent-Executed Scenario)
> 
> **Estimated Effort**: Short (Focus on execution & verification)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Env Setup → Backend Verify + Frontend Verify → E2E Verify

---

## Context

### Original Request
"test to verify our modification" (Active work on Backend Summary V4 + Frontend Chat)

### Interview Summary
**Key Discussions**:
- **Scope**: Full End-to-End Flow (Backend logic -> Frontend display)
- **Modifications**:
  - Backend: `SummaryEngine` (V4 Dynamic Two-Phase)
  - Frontend: `ChatContainer`, `ChatWorkspace.test.tsx`
- **Infrastructure**: Existing scripts (`test_summary_v4.py`) and standard tools (`vitest`, `playwright`) will be used.

### Guardrails (Self-Review)
- **Cost Control**: Backend integration script hits real OpenAI API. Run strictly once per verification cycle.
- **Data Safety**: Use test/fixture inputs. Do not modify production data.
- **No Refactoring**: Focus on *verification* of existing changes, not cleaning up unrelated code.

---

## Work Objectives

### Core Objective
Verify that the new V4 Summary Engine correctly plans and generates summaries, and the Frontend Chat correctly handles and displays these results.

### Concrete Deliverables
- [ ] Backend Verification Pass (Log output confirming V4 JSON structure)
- [ ] Frontend Verification Pass (Tests pass)
- [ ] E2E Success (Simulated user flow)

### Definition of Done
- [ ] `python backend/tests/integration/test_summary_v4.py` returns success
- [ ] `npm test` in frontend passes
- [ ] Manual/Agent E2E scenario completes without errors

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (Integration script + Unit tests)
- **Framework**: `pytest` / `vitest`

### Agent-Executed QA Scenarios (MANDATORY)

**Scenario 1: Backend V4 Summary Generation**
```
Scenario: Generate V4 Summary using Integration Script
  Tool: Bash (uv run)
  Preconditions: Valid .env with OPENAI_API_KEY
  Steps:
    1. uv run backend/tests/integration/test_summary_v4.py
    2. Wait for output "SUMMARY V4 OUTPUT"
    3. Assert stdout contains "DYNAMIC SECTIONS"
    4. Assert stdout contains "[Success] V4 summary generated!"
    5. Assert file exists: backend/tests/integration/output/summary_v4_test.json
  Expected Result: Valid JSON generated with V4 structure
  Failure Indicators: Python exceptions, missing keys in JSON
  Evidence: Terminal output + generated JSON file
```

**Scenario 2: Frontend Chat Unit Tests**
```
Scenario: Run Chat Workspace Tests
  Tool: Bash (npm test)
  Preconditions: Node dependencies installed
  Steps:
    1. cd frontend && npm test src/components/chat/__tests__/ChatWorkspace.test.tsx
    2. Wait for "PASS" in output
  Expected Result: All tests pass
  Failure Indicators: "FAIL" in output
  Evidence: Terminal output
```

**Scenario 3: E2E Chat Flow (Manual/Simulated)**
```
Scenario: Verify Chat loads and renders message
  Tool: interactive_bash (tmux) or Playwright (if configured)
  *Note*: Since full stack E2E is complex to spin up in agent env, we verify components.
  *Fallback*: If full stack running, navigate to /chat and check load.
```

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Component Verification):
├── Task 1: Verify Backend V4 Logic (Integration Script)
└── Task 2: Verify Frontend Chat Logic (Unit Tests)

Wave 2 (Integration):
└── Task 3: Final E2E Sanity Check
```

---

## TODOs

- [ ] 1. Verify Backend V4 Summary Engine

  **What to do**:
  - Run the existing integration script `backend/tests/integration/test_summary_v4.py`.
  - Analyze the output to ensure the "Planning" phase and "Generation" phase both executed.
  - Verify the output JSON structure has `sections`, `keypoints`, and `version: 4`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`backend-patterns`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1

  **References**:
  - `backend/tests/integration/test_summary_v4.py` - The runner script
  - `backend/services/summarizer/summary_engine.py` - The logic being tested

  **Acceptance Criteria**:
  - [ ] Command `uv run backend/tests/integration/test_summary_v4.py` exits code 0
  - [ ] Stdout contains "[Success] V4 summary generated!"
  - [ ] Output file `backend/tests/integration/output/summary_v4_test.json` is valid JSON

- [ ] 2. Verify Frontend Chat Components

  **What to do**:
  - Run the modified tests in `frontend/src/components/chat/__tests__/ChatWorkspace.test.tsx`.
  - Ensure `ChatContainer.tsx` changes didn't break existing functionality.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`webapp-testing`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1

  **References**:
  - `frontend/src/components/chat/__tests__/ChatWorkspace.test.tsx` - Test file
  - `frontend/package.json` - Test script command

  **Acceptance Criteria**:
  - [ ] Command `cd frontend && npm test src/components/chat/__tests__/ChatWorkspace.test.tsx` passes
  - [ ] No regressions in test coverage for ChatWorkspace

- [ ] 3. Synthesize & Report

  **What to do**:
  - Review evidence from Task 1 and Task 2.
  - If both pass, mark the verification as successful.
  - If failures occur, create a specific bug report or fix plan (separate task).

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`coding-standards`]

  **Parallelization**:
  - **Can Run In Parallel**: NO (Depends on 1 & 2)
  - **Parallel Group**: Wave 2

  **Acceptance Criteria**:
  - [ ] Final report summary generated in `.sisyphus/verification_report.md`
