# Feature Planning Documents

This directory contains planning documents for upcoming features. Each document tracks the design, implementation phases, and decision log for a specific feature.

## Active Features

| Feature | Status | Owner | Last Updated |
|---------|--------|-------|--------------|
| [Summary Block Rendering](./summary-block-rendering.md) | Planning | @haoran | 2026-02-01 |
| [Streaming Chat Summary](./streaming-chat-summary.md) | Planning | @haoran | 2026-02-01 |

## Feature Lifecycle

```
Planning → In Progress → Review → Shipped → Archived
```

## Document Template

When creating a new feature document, include:

1. **Problem Statement** - What problem are we solving?
2. **Goals** - What does success look like?
3. **Solution Overview** - High-level approach
4. **Implementation Phases** - Incremental delivery plan
5. **Decision Log** - Key decisions and rationale
6. **Open Questions** - Unresolved issues
7. **Related Files** - Code locations

## Related Documentation

- [AGENTS.md](../../AGENTS.md) - Project architecture (Single Source of Truth)
- [summary-block-architecture.md](../summary-block-architecture.md) - Detailed block architecture design
- [frontend_data_plane.md](../frontend_data_plane.md) - Frontend data flow patterns
