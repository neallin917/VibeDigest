"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Globe, FileText } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import type { LucideIcon } from "lucide-react"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import { Layers } from "lucide-react"

export default function LandingPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col min-h-screen bg-[#1C1C1C] text-[#EDEDED]">
      <div className="absolute top-4 right-4">
        <LanguageInlineSelect />
      </div>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {t("brand.versionTag")}
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">
            {t("landing.titlePrefix")} <span className="text-primary">{t("landing.titleEmphasis")}</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("landing.subtitle")}
          </p>
        </div>

        <div className="flex gap-4">
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-lg gap-2 bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(62,207,142,0.3)]">
              {t("landing.getStarted")} <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-6xl w-full">
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
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  )
}
