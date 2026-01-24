# Frontend Codemap

> Freshness: 2025-01-23T22:30:00Z

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | TailwindCSS, Framer Motion |
| **Components** | shadcn/ui |
| **Icons** | Lucide React |
| **Data** | Supabase Client (SSR + Client) |
| **Testing** | Vitest (Unit), Playwright (E2E) |

## Directory Structure

```
frontend/src/
├── app/                 # Next.js App Router
│   ├── api/             # API Routes (Backend Proxy)
│   ├── [lang]/          # i18n Dynamic Routes
│   └── layout.tsx       # Root Layout
├── components/          # React Components
│   ├── ui/              # shadcn/ui Primitives (24)
│   ├── chat/            # Chat Interface (17)
│   ├── tasks/           # Task Display (15)
│   ├── landing/         # Landing Sections (7)
│   ├── layout/          # App Layout (13)
│   ├── auth/            # Authentication (5)
│   └── i18n/            # Language Switcher
├── hooks/               # Custom React Hooks
├── lib/                 # Utilities
│   ├── api.ts           # Backend API Client
│   ├── i18n.ts          # Translations (141KB)
│   ├── supabase*.ts     # Supabase Clients
│   └── utils.ts         # Helpers
├── types/               # TypeScript Definitions
└── test/                # Test Setup
```

## App Router Structure

```
app/
├── layout.tsx                    # Root layout (fonts, providers)
├── page.tsx                      # Redirect to /[lang]
├── robots.ts                     # SEO robots.txt
├── sitemap.ts                    # SEO sitemap.xml
│
├── api/                          # API Routes
│   ├── process-video/route.ts    # → Backend proxy
│   ├── chat/route.ts             # AI chat (streaming)
│   ├── chat/threads/             # Chat thread management
│   ├── threads/                  # Thread CRUD
│   └── image-proxy/route.ts      # CORS image proxy
│
└── [lang]/                       # Dynamic i18n routes
    ├── layout.tsx                # Lang-specific layout
    ├── page.tsx                  # Landing page
    ├── login/page.tsx            # Login page
    ├── chat/page.tsx             # Chat interface
    ├── explore/page.tsx          # Explore tasks
    ├── about/page.tsx            # About page
    ├── faq/page.tsx              # FAQ page
    ├── terms/page.tsx            # Terms of service
    ├── privacy/page.tsx          # Privacy policy
    │
    ├── @auth/                    # Parallel route (modal)
    │   ├── default.tsx
    │   └── (.)login/page.tsx     # Intercepted login modal
    │
    └── (main)/                   # Authenticated routes
        ├── layout.tsx
        ├── settings/page.tsx     # User settings
        ├── settings/pricing/     # Pricing page
        ├── tasks/[id]/page.tsx   # Task detail
        ├── tasks/[id]/[slug]/    # Task with slug
        └── policies/             # Legal pages
```

## Component Library

### UI Primitives (shadcn/ui) - 24 components

```
components/ui/
├── button.tsx          ├── dialog.tsx
├── card.tsx            ├── dropdown-menu.tsx
├── input.tsx           ├── select.tsx
├── textarea.tsx        ├── sheet.tsx
├── tabs.tsx            ├── tooltip.tsx
├── badge.tsx           ├── avatar.tsx
├── label.tsx           ├── separator.tsx
├── progress.tsx        ├── switch.tsx
├── typography.tsx      ├── vignette.tsx
├── motion-wrapper.tsx  ├── theme-toggle.tsx
└── confirmation-modal.tsx
```

### Feature Components

| Folder | Count | Purpose |
|--------|-------|---------|
| `chat/` | 17 | Chat interface, messages, threads |
| `tasks/` | 15 | Video player, transcript, summary |
| `landing/` | 7 | Hero, features, pricing, testimonials |
| `layout/` | 13 | Header, footer, navigation |
| `auth/` | 5 | Login, OAuth buttons |
| `settings/` | 3 | Usage card, preferences |

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW                                │
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Server    │────▶│   Client    │────▶│   UI        │   │
│  │   Actions   │     │   State     │     │   Render    │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│        │                   │                               │
│        │                   │                               │
│        ▼                   ▼                               │
│  ┌─────────────┐     ┌─────────────┐                       │
│  │  Supabase   │     │  Supabase   │                       │
│  │  (Server)   │     │  Realtime   │                       │
│  │  SSR fetch  │     │  WebSocket  │                       │
│  └─────────────┘     └─────────────┘                       │
└─────────────────────────────────────────────────────────────┘

Key Patterns:
- Server Components for initial data fetch
- Client Components for interactivity
- Supabase Realtime for live updates (tasks)
- React Context for theme/locale
```

## i18n Configuration

| Property | Value |
|----------|-------|
| **Locales** | en, zh, es, ar, fr, ru, pt, hi, ja, ko |
| **Default** | en |
| **RTL** | Arabic (ar) auto-sets `dir="rtl"` |
| **Storage** | `localStorage` key `vd.locale` |
| **File Size** | 141KB (lib/i18n.ts) |

### Translation Structure

```typescript
const translations = {
  en: {
    common: { ... },
    landing: { ... },
    tasks: { ... },
    chat: { ... },
    settings: { ... },
  },
  zh: { ... },
  // ... other locales
}
```

## API Client (lib/api.ts)

```typescript
// Backend API wrapper
export const api = {
  processVideo: (url: string, lang: string) =>
    fetch('/api/process-video', { method: 'POST', body: ... }),

  previewVideo: (url: string) =>
    fetch('/api/preview-video', { method: 'POST', body: ... }),

  retryOutput: (outputId: string) =>
    fetch('/api/retry-output', { method: 'POST', body: ... }),
}
```

## Testing

| Type | Tool | Config |
|------|------|--------|
| Unit | Vitest | `vitest.config.ts` |
| E2E | Playwright | `playwright.config.ts` |
| Coverage | c8 | `frontend/coverage/` |

### Test Files

```
frontend/src/
├── components/ui/button.test.tsx
├── components/landing/HeroSection.test.tsx
├── components/landing/LandingNav.test.tsx
├── components/tasks/VideoEmbed.test.tsx
├── components/tasks/YouTubePlayer.test.tsx
├── app/api/chat/route.test.ts
└── e2e/                          # Playwright tests
```
