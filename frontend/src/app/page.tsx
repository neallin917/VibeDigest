"use client"

import { Button } from "@/components/ui/button"
import { Zap, Globe, FileText } from "lucide-react"
import { TaskForm } from "@/components/dashboard/TaskForm"
import { CommunityTemplates } from "@/components/dashboard/CommunityTemplates"
import { useI18n } from "@/components/i18n/I18nProvider"
import type { LucideIcon } from "lucide-react"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import { Layers } from "lucide-react"
import { Heading, Text } from "@/components/ui/typography"
import { GoogleOneTap } from "@/components/auth/GoogleOneTap"
import { LandingUserButton } from "@/components/auth/LandingUserButton"

export default function LandingPage() {
  const { t } = useI18n()

  const renderWithBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-[#F5F5F5] relative overflow-hidden">
      {/* Google One Tap Login */}
      <GoogleOneTap />
      {/* Grid Background Texture (anygen.io style) */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-grid opacity-50" />

      {/* Background Gradients - Enhanced with green theme */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[50%] h-[50%] bg-primary/12 rounded-full blur-[150px]" />
        <div className="absolute top-[-15%] right-[-10%] w-[45%] h-[45%] bg-emerald-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[15%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[35%] h-[35%] bg-primary/8 rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-6 right-4 z-50 flex items-center gap-3">
        <LandingUserButton />
        <LanguageInlineSelect />
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-14 md:py-16 lg:py-20 text-center space-y-10 relative z-10">
        <div className="space-y-6 max-w-4xl">
          <Heading
            as="h1"
            variant="display"
            className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/95 to-white/60 leading-[1.1]"
          >
            {t("landing.titlePrefix")}{" "}
            <span className="text-primary drop-shadow-[0_0_25px_rgba(62,207,142,0.4)]">
              {t("landing.titleEmphasis")}
            </span>
          </Heading>

          <Text tone="muted" className="max-w-2xl mx-auto text-lg md:text-xl leading-relaxed">
            {renderWithBold(t("landing.subtitle"))}
          </Text>
        </div>

        <div className="w-full max-w-3xl mx-auto z-20 mt-10">
          <TaskForm simple={true} />
        </div>

        {/* Community Samples */}
        <div className="w-full max-w-7xl mx-auto mt-16 px-4">
          <CommunityTemplates limit={4} />
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 md:mt-24 max-w-7xl w-full px-4">
          <FeatureCard
            icon={Zap}
            title={t("landing.feature1Title")}
            desc={renderWithBold(t("landing.feature1Desc"))}
          />
          <FeatureCard
            icon={Layers}
            title={t("landing.feature2Title")}
            desc={renderWithBold(t("landing.feature2Desc"))}
          />
          <FeatureCard
            icon={Globe}
            title={t("landing.feature3Title")}
            desc={renderWithBold(t("landing.feature3Desc"))}
          />
          <FeatureCard
            icon={FileText}
            title={t("landing.feature4Title")}
            desc={renderWithBold(t("landing.feature4Desc"))}
          />
        </div>
      </main>


    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc: React.ReactNode }) {
  return (
    <div className="group relative p-6 rounded-3xl bg-white/[0.03] backdrop-blur-md border border-white/5 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-500 text-left space-y-4 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/0 to-emerald-600/0 group-hover:from-primary/5 group-hover:to-emerald-600/5 transition-all duration-500 pointer-events-none" />

      <div className="relative">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-primary/30 transition-all duration-300">
          <Icon className="h-6 w-6 text-primary drop-shadow-[0_0_10px_rgba(62,207,142,0.5)] group-hover:text-emerald-400 transition-colors duration-300" />
        </div>
      </div>
      <Heading as="h3" variant="h3" className="relative group-hover:text-white transition-colors">
        {title}
      </Heading>
      <Text tone="muted" variant="bodySm" className="relative leading-relaxed group-hover:text-muted-foreground/90 transition-colors">
        {desc}
      </Text>
    </div>
  )
}
