# Testing Strategy & Principles

This document outlines the testing philosophy and strategy for the AI Video Transcriber project.

## Core Principles

1.  **Reality Over Green Lights**: Tests must reflect the actual behavior of the application. We do not modify tests to strictly "pass" if it means compromising the verification of business logic (No "Fix the test, not the bug" mentality).
2.  **No "Pleasing" Tests**: Tests should not test for features that do not exist just to satisfy a checklist. Assertions must match the implemented reality.
3.  **Robustness**: Tests should be resilient to minor implementation details (e.g., whitespace flexibility in text matching, chainable mock objects) while remaining strict on business rules.

## Testing Stack

-   **Unit/Integration Tests**: `Vitest` + `React Testing Library`
    -   Focus: Component rendering, user interactions, hook logic, utility functions.
    -   Location: `__tests__` directories or `*.test.tsx` files alongside components.
-   **End-to-End (E2E) Tests**: `Playwright`
    -   Focus: Critical user journeys (Smoke tests, Chat flows, Authentication).
    -   Location: `frontend/e2e/` directory.

## Recent Fixes & Improvements (Jan 2026)

### 1. Robust Unit Testing
-   **Mock Chain Support**: Updated Supabase mocks to support chainable methods (e.g., `.from().select().eq()`) to match actual API usage, preventing "property undefined" errors in tests.
-   **Realistic Assertions**: Removed assertions for UI sections (e.g., "Action Items", "Risks") that are not yet implemented in the legacy `VideoDetailPanel`. prevented tests from failing on future-scoped features.
-   **Text Matching**: Switched to regex-based matching (e.g., `/Key\s+Insights/i`) to handle whitespace collapsing in JSX rendering robustly.
-   **Navigation & Routing**: Updated expectations in `Sidebar` tests to match the actual route paths (e.g., `/chat` vs `/en/chat`) used by the new Proxy/Middleware strategy.

### 2. Environment Stability
-   **Sentry & Node 25**: Configured Sentry to be disabled during test runs (`NEXT_DIST_DIR=.next-test`) to prevent conflicts with Node.js 25's native Web Streams implementation which caused E2E crashes.

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:cov
```

### E2E Tests
```bash
# Run smoke tests
npx playwright test e2e/smoke.spec.ts
```
