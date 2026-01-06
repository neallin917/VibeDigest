
import { Metadata } from 'next'
import { ServerCommunityTemplates } from "@/components/dashboard/ServerCommunityTemplates"
import { Suspense } from 'react'
import { LandingNav } from "@/components/landing/LandingNav"
import { TemplatesSkeleton } from "@/components/dashboard/TemplatesSkeleton"

export const metadata: Metadata = {
    title: 'Explore AI Video Summaries | VibeDigest',
    description: 'Browse our extensive collection of AI-generated video summaries. Discover insights from tutorials, news, tech reviews, and more.',
    alternates: {
        canonical: '/en/explore',
    }
}

export default function ExplorePage({ params }: { params: { lang: string } }) {
    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans flex flex-col">
            <LandingNav />

            <div className="fixed inset-0 z-0 pointer-events-none bg-grid opacity-30" />

            <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-24 relative z-10">
                <div className="mb-12 text-center max-w-2xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        Explore Community Summaries
                    </h1>
                    <p className="text-lg text-gray-400">
                        Discover what others are watching and summarizing with AI. Browse through thousands of processed videos.
                    </p>
                    <p className="text-sm text-gray-500 mt-4 flex items-center justify-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/50"></span>
                        These are curated public demos. Your personal tasks are private by default.
                    </p>
                </div>

                <Suspense fallback={<TemplatesSkeleton />}>
                    <ServerCommunityTemplates limit={100} showHeader={false} />
                </Suspense>
            </main>

            <footer className="py-10 text-center text-gray-600 text-sm border-t border-white/5 relative z-10 bg-[#0A0A0A]">
                <p>© 2024 VibeDigest. All rights reserved.</p>
                <div className="mt-4 flex justify-center gap-6">
                    <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                    <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                </div>
            </footer>
        </div>
    )
}
