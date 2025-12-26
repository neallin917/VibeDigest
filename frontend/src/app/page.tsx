"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Globe, FileText } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import type { LucideIcon } from "lucide-react"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import { Layers } from "lucide-react"
import { Heading, Text } from "@/components/ui/typography"

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
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] text-[#EDEDED] relative overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/15 rounded-full blur-[120px]" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-500/15 rounded-full blur-[120px]" />
      </div>

      <div className="absolute top-8 right-4 z-50">
        <LanguageInlineSelect />
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-14 md:py-16 lg:py-20 text-center space-y-8 relative z-10">
        <div className="space-y-4 max-w-3xl">
          <Heading
            as="h1"
            variant="display"
            className="bg-clip-text text-transparent bg-gradient-to-r from-white via-white/90 to-white/50"
          >
            {t("landing.titlePrefix")} <span className="text-primary drop-shadow-[0_0_15px_rgba(62,207,142,0.3)]">{t("landing.titleEmphasis")}</span>
          </Heading>

          <Text tone="muted" className="max-w-2xl mx-auto text-lg md:text-xl">
            {renderWithBold(t("landing.subtitle"))}
          </Text>
        </div>

        <div className="w-full flex justify-center gap-4">
          <Link href="/login">
            <Button
              size="xl"
              className="px-8 gap-2 bg-primary text-black hover:bg-primary/90 shadow-[0_0_30px_rgba(62,207,142,0.4)] hover:shadow-[0_0_40px_rgba(62,207,142,0.6)] transition-all duration-300"
            >
              {t("landing.getStarted")} <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
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
    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-left space-y-4 hover:shadow-lg hover:shadow-black/20">
      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(62,207,142,0.5)]" />
      </div>
      <Heading as="h3" variant="h3" className="group-hover:text-white transition-colors">
        {title}
      </Heading>
      <Text tone="muted" variant="bodySm" className="leading-relaxed">
        {desc}
      </Text>
    </div>
  )
}
