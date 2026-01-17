# Task 2.0: Setup Workspace & Theming

> **Phase**: 2 - Frontend Implementation  
> **Priority**: Critical  
> **Estimated Time**: 45 minutes  
> **Dependencies**: None

---

## 🎯 Objective

Prepare the development environment for the **Dual-Theme (Light/Dark)** redesign. Install necessary dependencies, configure Tailwind for theming, and set up global styles.

---

## 📋 Prerequisites

- [ ] Node.js 18+ installed
- [ ] Frontend directory exists

---

## 🔨 Implementation Steps

### Step 1: Install Dependencies

**Action**: Install UI libraries and theming utilities.

```bash
cd frontend

# Core UI & Theming
npm install next-themes clsx tailwind-merge lucide-react

# AI SDK v6 (Critical Requirement)
npm install ai@^4.0.0 @ai-sdk/react@^1.0.0 @ai-sdk/openai@^1.0.0

# Radix UI Primitives (for Modals/Sheets)
npm install @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-tabs @radix-ui/react-scroll-area
```

### Step 2: Configure Fonts & Layout

**File**: `frontend/src/app/layout.tsx`

Add `Plus Jakarta Sans` and the `ThemeProvider`.

```tsx
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider' // We'll create this next
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Step 3: Create ThemeProvider

**File**: `frontend/src/components/theme-provider.tsx`

```tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### Step 4: Configure Tailwind

**File**: `frontend/tailwind.config.ts`

Add the font family and extended colors.

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"], // Vital for manual toggling
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "sans-serif"],
      },
      colors: {
        // Semantic colors can go here if needed
        glass: {
          border: "rgba(255, 255, 255, 0.5)",
          surface: "rgba(255, 255, 255, 0.65)",
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-glow": "0 0 20px rgba(255, 255, 255, 0.5)",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config
```

### Step 5: Global CSS & Animations

**File**: `frontend/src/app/globals.css`

Define the blob animations for Light Mode and the clean dark background for Dark Mode.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
 
  .dark {
    --background: 0 0% 4%; /* #0A0A0A */
    --foreground: 210 40% 98%;
  }

  body {
    @apply bg-background text-foreground;
  }

  /* Light Mode Background - Radial Gradients */
  body:not(.dark) {
    background: 
      radial-gradient(circle at 0% 0%, #eef2ff 0%, transparent 50%), 
      radial-gradient(circle at 100% 0%, #fce7f3 0%, transparent 50%),
      radial-gradient(circle at 100% 100%, #e0f2fe 0%, transparent 50%),
      #ffffff;
    background-attachment: fixed;
  }

  /* Dark Mode Background - Deep Space */
  body.dark {
    background-color: #0A0A0A;
    background-image: radial-gradient(circle at 50% 0%, #1a1a1a 0%, #0A0A0A 60%);
  }
}

/* Blob Animations (Light Mode Only) */
@keyframes morph {
  0% { border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%; }
  50% { border-radius: 60% 30% 30% 60% / 40% 60% 40% 60%; }
  100% { border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%; }
}

.blob {
  @apply absolute blur-[80px] -z-10 opacity-60;
  animation: morph 15s infinite;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  @apply bg-black/10 dark:bg-white/10 rounded-full;
}
```

### Step 6: Create Component Structure

```bash
mkdir -p src/components/chat
mkdir -p src/components/chat/messages
mkdir -p src/components/tasks/shared
```

---

## ✅ Validation Checklist

- [ ] `npm run dev` starts without errors
- [ ] Font is "Plus Jakarta Sans"
- [ ] Light mode shows radial gradient background
- [ ] Dark mode shows deep black background
- [ ] Theme toggling works (can test by manually changing system pref or adding a temp button)

## 📝 Next Steps

**Proceed to**: `task-2.1-chat-workspace.md`
