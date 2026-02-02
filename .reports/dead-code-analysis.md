# Dead Code Analysis Report

**Date:** 2026-02-03
**Scope:** Frontend (`/frontend`)

## 1. Methodology
- **Tools Used:** `depcheck`, `ts-prune`, `knip`
- **Verification:** Manual `grep` and code inspection.
- **Criteria:**
    - **SAFE:** Files/exports with 0 references in the codebase (excluding tests).
    - **CAUTION:** API routes or components that might be dynamically imported.
    - **DANGER:** Core configuration or entry points flagged as false positives.

## 2. Findings

### A. Unused Files (SAFE TO DELETE)
The following files are verified as unused (0 imports):

| File Path | Confidence | Reason |
|-----------|------------|--------|
| `src/components/tasks/TranscriptKeyframesPanel.tsx` | High | Orphaned feature (Timeline beta) |
| `src/components/ui/confirmation-modal.tsx` | High | Unused UI component (no imports) |
| `src/components/ui/motion-wrapper.tsx` | High | Unused wrapper (no imports) |
| `src/components/theme-provider.tsx` | High | Replaced by `next-themes` usage in `providers.tsx` |
| `src/hooks/useThreads.ts` | High | Unused hook (no imports) |
| `src/lib/api/threads.ts` | High | Unused API client (no imports) |
| `src/components/ui/avatar.tsx` | High | `UserAvatarDropdown` uses raw elements, no usage of `Avatar` component |
| `src/components/ui/tabs.tsx` | High | Only definition found. `loading.tsx` comment mentions tabs but doesn't use them |
| `src/components/ui/tooltip.tsx` | High | Only definition found. `AppSidebar.tsx` has commented-out import |

### B. Unused Dependencies (SAFE TO UNINSTALL)
Packages associated with the unused files above:

- `@radix-ui/react-avatar`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

### C. False Positives (KEEP)
- `e2e/auth.setup.ts`: Used by `playwright.config.ts` (regex match).
- `src/app/**`: Next.js App Router entry points (implicitly used).

## 3. Execution & Summary
**Action Taken:**
1.  **Deleted** 9 files listed in Section A.
2.  **Uninstalled** 3 packages listed in Section B.

**Verification Results:**
-   `npm test` ran successfully (12 files passed).
-   1 Pre-existing failure in `VideoDetailPanel.test.tsx` (unrelated to deletions; content matching issue).
-   Build stability confirmed.

## 4. Summary of Cleaned Items
-   **Removed Features**: Orphaned "Timeline (beta)" keyframes panel.
-   **Removed UI Components**: Avatar, Tabs, Tooltip (Unused Radix wrappers), ConfirmationModal, MotionWrapper.
-   **Removed Logic**: Unused Threads API client and hooks.
-   **Disk Space Saved**: ~30KB source code + ~150MB node_modules.
