
import { Metadata } from 'next'
import { ServerCommunityTemplates } from "@/components/templates/ServerCommunityTemplates"
import { Suspense } from 'react'
import { LandingNav } from "@/components/landing/LandingNav"
import { TemplatesSkeleton } from "@/components/templates/TemplatesSkeleton"
import Link from "next/link"

export const metadata: Metadata = {
    title: 'Explore AI Video Summaries | VibeDigest',
    description: 'Browse our extensive collection of AI-generated video summaries. Discover insights from tutorials, news, tech reviews, and more.',
    alternates: {
        canonical: '/en/explore',
    }
}

export default function ExplorePage() {
    return (
        <div className="min-h-screen bg-transparent text-slate-800 dark:text-[#F5F5F5] font-sans flex flex-col">
            <LandingNav />

            {/* Background Blobs (Light Mode) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            {/* Dark Mode Background */}
            <div className="fixed inset-0 hidden dark:block pointer-events-none -z-10 bg-[#0A0A0A]">
                <div className="absolute inset-0 bg-grid opacity-30" />
            </div>

            <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-24 relative z-10">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-white/70">
                        Explore Community Summaries
                    </h1>
                    <p className="text-base text-slate-600 dark:text-gray-400">
                        Discover what others are watching and summarizing with AI. Browse through thousands of processed videos.
                    </p>
                    <p className="text-sm text-slate-500 dark:text-gray-500 mt-4 flex items-center justify-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500/50 dark:bg-emerald-500/50"></span>
                        These are curated public demos. Your personal tasks are private by default.
                    </p>
                </div>

                <Suspense fallback={<TemplatesSkeleton />}>
                    <ServerCommunityTemplates limit={100} showHeader={false} />
                </Suspense>
            </main>

            <footer className="py-8 text-center text-slate-500 dark:text-gray-600 text-xs border-t border-slate-200 dark:border-white/5 relative z-10 bg-white/50 dark:bg-[#0A0A0A] backdrop-blur-sm">
                <p>© 2024 VibeDigest. All rights reserved.</p>
                <div className="mt-3 flex justify-center gap-5">
                    <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy Policy</Link>
                    <Link href="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms of Service</Link>
                </div>
            </footer>
        </div>
    )
}
