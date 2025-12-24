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

  return (
    <div className="flex flex-col min-h-screen bg-[#1C1C1C] text-[#EDEDED]">
      <div className="absolute top-4 right-4">
        <LanguageInlineSelect />
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-14 md:py-16 lg:py-20 text-center space-y-8">
        <div className="space-y-4 max-w-3xl">
          <Heading
            as="h1"
            variant="display"
            className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50"
          >
            {t("landing.titlePrefix")} <span className="text-primary">{t("landing.titleEmphasis")}</span>
          </Heading>

          <Text tone="muted" className="max-w-2xl mx-auto">
            {t("landing.subtitle")}
          </Text>
        </div>

        <div className="flex gap-4">
          <Link href="/login">
            <Button
              size="xl"
              className="px-8 gap-2 bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(62,207,142,0.3)]"
            >
              {t("landing.getStarted")} <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 md:mt-16 max-w-6xl w-full">
          <FeatureCard
            icon={Zap}
            title={t("landing.feature1Title")}
            desc={t("landing.feature1Desc")}
          />
          <FeatureCard
            icon={FileText}
            title={t("landing.feature2Title")}
            desc={t("landing.feature2Desc")}
          />
          <FeatureCard
            icon={Globe}
            title={t("landing.feature3Title")}
            desc={t("landing.feature3Desc")}
          />
          <FeatureCard
            icon={Layers}
            title={t("landing.feature4Title")}
            desc={t("landing.feature4Desc")}
          />
        </div>
      </main>


    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors text-left space-y-3">
      <div className="h-10 w-10 rounded-lg bg-black/40 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <Heading as="h3" variant="h3">
        {title}
      </Heading>
      <Text tone="muted" variant="bodySm">
        {desc}
      </Text>
    </div>
  )
}
