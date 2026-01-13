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

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 relative overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      {/* Texture Overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-noise opacity-50 mix-blend-overlay" />

      {/* Login & Nav */}
      <GoogleOneTap />
      <LandingNav />

      {/* Global Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep Space Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-teal-900/10 rounded-full blur-[150px] animate-float-slow" style={{ animationDelay: '4s' }} />

        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black_70%)]" />
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
          <a href={`/${lang}/about`} className="hover:text-white transition-colors">{lang === 'zh' ? '关于我们' : 'About'}</a>
          <a href={`/${lang}/faq`} className="hover:text-white transition-colors">{lang === 'zh' ? '常见问题' : 'FAQ'}</a>
          <a href={`/${lang}/privacy`} className="hover:text-white transition-colors">{lang === 'zh' ? '隐私政策' : 'Privacy Policy'}</a>
          <a href={`/${lang}/terms`} className="hover:text-white transition-colors">{lang === 'zh' ? '服务条款' : 'Terms of Service'}</a>
        </div>
      </footer>
    </div>
  )
}
