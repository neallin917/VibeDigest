"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { I18nProvider } from "@/components/i18n/I18nProvider"

import { ThemeProvider } from "next-themes"

export function Providers({ children, locale }: { children: React.ReactNode, locale?: string }) {
    const [queryClient] = useState(() => new QueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                disableTransitionOnChange
            >
                <I18nProvider locale={locale as any}>
                    {children}
                </I18nProvider>
            </ThemeProvider>
        </QueryClientProvider>
    )
}
