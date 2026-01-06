"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { I18nProvider } from "@/components/i18n/I18nProvider"

export function Providers({ children, locale }: { children: React.ReactNode, locale?: string }) {
    const [queryClient] = useState(() => new QueryClient())

    // Type assertion to ensure string matches Locale type if needed, or pass as is if compatible
    return (
        <QueryClientProvider client={queryClient}>
            <I18nProvider locale={locale as any}>
                {children}
            </I18nProvider>
        </QueryClientProvider>
    )
}
