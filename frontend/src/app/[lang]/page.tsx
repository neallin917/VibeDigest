import { GoogleOneTap } from "@/components/auth/GoogleOneTap"
import { LandingNav } from "@/components/landing/LandingNav"
import { HeroSection } from "@/components/landing/HeroSection"
import { FeaturesSection } from "@/components/landing/FeaturesSection"
import { HowItWorksSection } from "@/components/landing/HowItWorksSection"
import { PricingSection } from "@/components/landing/PricingSection"
import { TestimonialsSection } from "@/components/landing/TestimonialsSection"
import { SupportCTA } from "@/components/landing/SupportCTA"
import { ServerCommunityTemplates } from "@/components/dashboard/ServerCommunityTemplates"
import { TemplatesSkeleton } from "@/components/dashboard/TemplatesSkeleton"
import { Suspense } from "react"
import Link from "next/link"

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return (
    <div className="flex flex-col min-h-screen bg-transparent text-slate-800 dark:text-zinc-100 relative overflow-hidden font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* Background Blobs (Light Mode) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10 bg-[#FAFAFA]">
        <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[100px] mix-blend-multiply animate-float-slow" />
        <div className="absolute top-[20%] left-[-10%] w-[35%] h-[35%] bg-purple-200/30 rounded-full blur-[100px] mix-blend-multiply animate-float-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[45%] h-[45%] bg-teal-200/30 rounded-full blur-[100px] mix-blend-multiply animate-float-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      {/* Dark Mode Background - refined deep space */}
      <div className="fixed inset-0 hidden dark:block pointer-events-none -z-10 bg-[#050505]">
        {/* Subtle top glow */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] h-[60%] bg-emerald-900/10 rounded-[100%] blur-[120px]" />
        
        {/* Moving aurora elements */}
        <div className="absolute top-[10%] right-[-10%] w-[40%] h-[40%] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-teal-900/10 rounded-full blur-[100px] animate-float-slow" style={{ animationDuration: '10s' }} />
        
        {/* Grid Overlay with fade out */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />
      </div>

      {/* Login & Nav */}
      <GoogleOneTap />
      <LandingNav />

      <main className="flex-1 w-full relative z-10">
        <HeroSection />

        {/* Community Section */}
        <div id="demos" className="max-w-6xl mx-auto px-6 mb-20 scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-indigo-600 dark:bg-primary rounded-full"></div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Community</h2>
            <span className="text-xs text-slate-500 dark:text-gray-500 hidden md:inline-block">Curated public demos. Your tasks are private.</span>
          </div>

          <Suspense fallback={<TemplatesSkeleton />}>
            <ServerCommunityTemplates limit={8} showHeader={false} />
          </Suspense>

          <div className="mt-8 flex justify-center">
            <Link
              href="/explore"
              className="group flex items-center gap-2 px-6 py-2.5 rounded-full text-sm bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-primary/50 text-slate-700 dark:text-white font-medium transition-all hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(34,197,94,0.15)]"
            >
              View All
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>

        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <TestimonialsSection />
        <SupportCTA />
      </main>

      <footer className="py-8 text-center text-slate-500 dark:text-gray-600 text-xs border-t border-slate-200 dark:border-white/5 relative z-10 bg-white/50 dark:bg-[#0A0A0A] backdrop-blur-sm">
        <p>© 2024 VibeDigest. All rights reserved.</p>
        <div className="mt-3 flex justify-center gap-5">
          <a href={`/${lang}/about`} className="hover:text-slate-900 dark:hover:text-white transition-colors">{lang === 'zh' ? '关于我们' : 'About'}</a>
          <a href={`/${lang}/faq`} className="hover:text-slate-900 dark:hover:text-white transition-colors">{lang === 'zh' ? '常见问题' : 'FAQ'}</a>
          <a href={`/${lang}/privacy`} className="hover:text-slate-900 dark:hover:text-white transition-colors">{lang === 'zh' ? '隐私政策' : 'Privacy Policy'}</a>
          <a href={`/${lang}/terms`} className="hover:text-slate-900 dark:hover:text-white transition-colors">{lang === 'zh' ? '服务条款' : 'Terms of Service'}</a>
        </div>
      </footer>
    </div>
  )
}
