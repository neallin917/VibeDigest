"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Sparkles } from "lucide-react"

const navItems = [
    { id: "hero", key: "product" },
    { id: "demos", key: "demos" },
    { id: "features", key: "features" },
    { id: "how-it-works", key: "howItWorks" },
    { id: "pricing", key: "pricing" },
] as const

export function LandingNav() {
    const { locale } = useI18n()
    const [activeSection, setActiveSection] = useState<string>("hero")
    const [isScrolled, setIsScrolled] = useState(false)

    // Labels for navigation items
    const labels: Record<string, string> = {
        product: locale === "zh" ? "产品" : "Product",
        demos: locale === "zh" ? "社区示例" : "Demos",
        features: locale === "zh" ? "功能" : "Features",
        howItWorks: locale === "zh" ? "使用方法" : "How It Works",
        pricing: locale === "zh" ? "定价" : "Pricing",
    }

    useEffect(() => {
        const handleScroll = () => {
            // Check if scrolled past hero section
            setIsScrolled(window.scrollY > 50)

            // Determine active section based on scroll position
            const sections = navItems.map((item) => ({
                id: item.id,
                element: document.getElementById(item.id),
            }))

            const scrollPosition = window.scrollY + 200 // Offset for better UX

            let foundActive = false
            for (let i = sections.length - 1; i >= 0; i--) {
                const section = sections[i]
                if (section.element) {
                    const offsetTop = section.element.offsetTop
                    if (scrollPosition >= offsetTop) {
                        setActiveSection(section.id)
                        foundActive = true
                        break
                    }
                }
            }
            // Default to first item (hero) when at top
            if (!foundActive) {
                setActiveSection("hero")
            }
        }

        window.addEventListener("scroll", handleScroll, { passive: true })
        handleScroll() // Initial check

        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id)
        if (element) {
            const headerOffset = 100
            const elementPosition = element.getBoundingClientRect().top
            const offsetPosition = elementPosition + window.scrollY - headerOffset

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth",
            })
        }
    }

    return (
        <nav
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ${isScrolled ? "shadow-xl shadow-black/30" : ""
                }`}
        >
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#1a1a1a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
                {/* Brand Logo */}
                <div
                    onClick={() => scrollToSection("hero")}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer group"
                >
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
                        <Sparkles className="w-3.5 h-3.5 text-black" />
                    </div>
                    <span className="text-sm font-semibold text-white/90 hidden sm:block">VibeDigest</span>
                </div>

                {/* Separator */}
                <div className="w-px h-5 bg-white/10 mx-1" />

                {/* Nav Items */}
                {navItems.slice(1).map((item) => (
                    <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all duration-200 ${activeSection === item.id
                            ? "bg-primary text-black shadow-lg shadow-primary/25"
                            : "text-white/60 hover:text-white hover:bg-white/[0.08]"
                            }`}
                    >
                        {labels[item.key]}
                    </button>
                ))}
            </div>
        </nav>
    )
}
