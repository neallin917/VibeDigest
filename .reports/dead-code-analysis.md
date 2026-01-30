# Dead Code Analysis Report

**Generated:** 2026-01-30
**Last Cleanup:** 2026-01-30
**Tools Used:** knip, depcheck, ts-prune

---

## Cleanup Summary (2026-01-30)

### ✅ Successfully Removed

| Category | Items | Savings |
|----------|-------|---------|
| Remotion Files | 6 files | ~50KB |
| Debug Scripts | 2 files | ~5KB |
| Unused Components | 5 files | ~15KB |
| Unused Dependencies | 10 packages | ~200MB node_modules |

### Deleted Files

**Remotion (Video Generation - Feature Abandoned):**
- `remotion.config.ts`
- `src/remotion/index.ts`
- `src/remotion/Root.tsx`
- `src/remotion/style.css`
- `src/remotion/components/MockChat.tsx`
- `src/remotion/compositions/PromoVideo.tsx`

**Debug/Test Scripts:**
- `reproduce_issue.js`
- `scripts/test-url-extraction.js`

**Unused Components:**
- `src/components/chat/LibrarySidebar.tsx`
- `src/components/chat/messages/VideoCardMessage.tsx`
- `src/components/tasks/MindMap.tsx`
- `src/components/tasks/mindmap.css`
- `src/components/tasks/SummaryExportButton.tsx`

### Removed Dependencies

**Production Dependencies:**
- `@xyflow/react` - MindMap component dependency
- `date-fns` - Only used in deleted LibrarySidebar
- `html-to-image` - Only used in deleted SummaryExportButton

**Dev Dependencies:**
- `@remotion/cli`
- `@remotion/shapes`
- `@remotion/tailwind`
- `remotion`
- `css-loader` - Webpack loader for Remotion
- `postcss-loader` - Webpack loader for Remotion
- `style-loader` - Webpack loader for Remotion

### Removed Scripts

- `video:preview` - Remotion preview command
- `video:render` - Remotion render command

---

## Remaining Items (Review Before Deleting)

### 🟡 CAUTION - May Be Needed

#### Unused UI Components (shadcn/ui)
| File | Status | Notes |
|------|--------|-------|
| `src/components/ui/avatar.tsx` | ✅ KEEP | Used in TopHeader, UserAvatarDropdown, LandingUserButton |
| `src/components/ui/tabs.tsx` | ✅ KEEP | Used in loading.tsx |
| `src/components/ui/tooltip.tsx` | ✅ KEEP | Used in AppSidebar |
| `src/components/ui/confirmation-modal.tsx` | ⚠️ Review | May be planned for use |
| `src/components/ui/motion-wrapper.tsx` | ⚠️ Review | Framer motion wrapper |

#### Unused Hooks
| File | Notes |
|------|-------|
| `src/hooks/useTaskStream.ts` | Untracked file - may be WIP |
| `src/hooks/useThreads.ts` | Thread management - may be planned |

#### Unused Lib Files
| File | Notes |
|------|-------|
| `src/lib/api/threads.ts` | Thread API functions - may be planned |
| `src/lib/supabase/proxy.ts` | Supabase proxy - may be needed |

### 🔴 DANGER - Do NOT Delete

These files/exports are used dynamically or through implicit imports:

| Location | Export | Reason |
|----------|--------|--------|
| `src/components/ui/dialog.tsx` | `DialogOverlay`, `DialogPortal` | Radix UI primitives |
| `src/components/ui/select.tsx` | Multiple exports | Select primitives |
| `src/components/ui/sheet.tsx` | Multiple exports | Sheet primitives |
| `src/types/generated/*` | All exports | Auto-generated types |

---

## Dependencies Status

### Currently Used Dependencies (Keep)
- `@radix-ui/react-avatar` - Avatar component in use
- `@radix-ui/react-tabs` - Tabs component in use
- `@radix-ui/react-tooltip` - Tooltip component in use

### Potentially Unused (Verify Before Removing)
- None identified at this time

---

## Next Steps

1. **Monitor** `useThreads.ts` and `useTaskStream.ts` - if not used within 30 days, consider removing
2. **Review** unused UI components (`confirmation-modal.tsx`, `motion-wrapper.tsx`)
3. **Run** `npm install` to sync node_modules with updated package.json
4. **Consider** running `npm audit` to check for security vulnerabilities

---

## Verification

All changes verified with:
- ✅ `npm test -- --run` (58 tests passed)
- ✅ `npm run build` (build successful)
- ✅ No import errors detected
