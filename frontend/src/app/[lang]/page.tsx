import { GoogleOneTap } from "@/components/auth/GoogleOneTap"
import { LandingUserButton } from "@/components/auth/LandingUserButton"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import { HeroSection } from "@/components/landing/HeroSection"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { TestimonialsSection } from "@/components/landing/TestimonialsSection"
import { SupportCTA } from "@/components/landing/SupportCTA"
import { LandingNav } from "@/components/landing/LandingNav"
import { ServerCommunityTemplates } from "@/components/dashboard/ServerCommunityTemplates"
import { TemplatesSkeleton } from "@/components/dashboard/TemplatesSkeleton"
import { Suspense } from "react"

export default function LandingPage() {
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



      <main className="flex-1 w-full">
        <HeroSection />

        <div id="demos" className="max-w-7xl mx-auto px-6 mb-24 relative z-10 scroll-mt-24">

          <div className="flex items-center gap-4 mb-8">
            <div className="w-1 h-8 bg-primary rounded-full"></div>
            <h2 className="text-2xl font-bold">Community</h2>
            <span className="text-sm text-gray-500 hidden md:inline-block">Curated public demos. Your tasks are private.</span>
          </div>

          <Suspense fallback={<TemplatesSkeleton />}>
            <ServerCommunityTemplates limit={8} showHeader={false} />
          </Suspense>

          <div className="mt-10 flex justify-center">
            <a
              href="/explore"
              className="group flex items-center gap-2 px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 text-white font-medium transition-all hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
            >
              View All
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </a>
          </div>
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
