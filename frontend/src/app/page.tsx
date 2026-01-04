import { GoogleOneTap } from "@/components/auth/GoogleOneTap"
import { LandingUserButton } from "@/components/auth/LandingUserButton"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import { CommunityTemplates } from "@/components/dashboard/CommunityTemplates"
import { HeroSection } from "@/components/landing/HeroSection"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { TestimonialsSection } from "@/components/landing/TestimonialsSection"
import { SupportCTA } from "@/components/landing/SupportCTA"
import { LandingNav } from "@/components/landing/LandingNav"
import { createClient } from "@/lib/supabase/server"

// Demo tasks are managed via is_demo field in the database
// No hardcoded IDs needed - just set is_demo = true in Supabase

type TaskOutput = {
  kind: string
  content: string | object
}

type Task = {
  id: string
  video_url: string
  video_title?: string
  thumbnail_url?: string
  status: string
  created_at: string
  author?: string
  author_image_url?: string
  task_outputs?: TaskOutput[]
}

export default async function LandingPage() {
  const supabase = await createClient()

  // Query tasks where is_demo = true (managed in database)
  // Also fetch task_outputs to get classification
  const { data } = await supabase
    .from('tasks')
    .select(`
            id, 
            video_url, 
            video_title, 
            thumbnail_url, 
            status, 
            created_at, 
            author, 
            author_image_url,
            task_outputs (
                kind,
                content
            )
        `)
    .eq('is_demo', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(8)

  const initialTasks = (data || []) as any as Task[]

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-[#F5F5F5] relative overflow-hidden font-sans">
      {/* Google One Tap Login */}
      <GoogleOneTap />

      {/* Floating Navigation */}
      <LandingNav />

      {/* Global Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-grid opacity-30" />
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute top-[-15%] right-[-10%] w-[45%] h-[45%] bg-emerald-600/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[15%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <LandingUserButton />
        <LanguageInlineSelect />
      </header>

      <main className="flex-1 w-full">
        <HeroSection />

        <div id="demos" className="max-w-7xl mx-auto px-6 mb-24 relative z-10 scroll-mt-24">

          <div className="flex items-center gap-4 mb-8">
            <div className="w-1 h-8 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold">Community Examples</h2>
            <span className="text-sm text-gray-500 hidden md:inline-block">Try these ready-made examples</span>
          </div>

          <CommunityTemplates limit={8} showHeader={false} initialTasks={initialTasks} />
        </div>

        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <SupportCTA />
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
