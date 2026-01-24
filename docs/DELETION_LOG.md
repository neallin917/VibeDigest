# Code Deletion Log

## [2026-01-22] Refactor Session

### Unused Dependencies Removed (Frontend)
- @ai-sdk/provider - Last used: never
- @ai-sdk/provider-utils - Last used: never
- @formatjs/intl-localematcher - Last used: never (i18n middleware not using it)
- @radix-ui/react-scroll-area - Last used: never (Component not present)
- @rainbow-me/rainbowkit - Last used: never
- negotiator - Last used: never
- viem - Last used: never
- wagmi - Last used: never
- tw-animate-css - Last used: never
- cva - Last used: never (Ghost dependency, project uses class-variance-authority)
- @assistant-ui/react-ai-sdk - Last used: never
- @types/negotiator - Last used: never (Orphaned types)

### Unused Files Deleted
- src/hooks/useThreads.ts - Reason: No references found in codebase
- src/lib/api/threads.ts - Reason: Only used by unused useThreads hook
- backend/dummy_graph.py - Reason: Unused placeholder graph
- reproduce_issue.py - Reason: Root-level reproduction script
- temp_to_claude.txt - Reason: Temporary artifact
- task_dump.json - Reason: Temporary artifact

### Configuration Updates
- backend/langgraph.json - Removed "dummy" graph entry
- docker-compose.yml - Removed "dummy" graph from LANGSERVE_GRAPHS

### Impact
- Dependencies removed: 12
- Files deleted: 6
- Configs updated: 2

### Testing
- [ ] Build succeeds
- [ ] Tests pass
