"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Menu } from "lucide-react"
import { LandingUserButton } from "@/components/auth/LandingUserButton"
import { BrandLogo } from "@/components/layout/BrandLogo"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter, usePathname } from "next/navigation"

import Link from "next/link"

type NavItem = {
    id: string
    key: string
    href?: string
}

const navItems: NavItem[] = [
    { id: "hero", key: "product" },
    { id: "demos", key: "demos" },
    { id: "features", key: "features" },
    { id: "how-it-works", key: "howItWorks" },
    { id: "pricing", key: "pricing" },
    { id: "faq", key: "faq", href: "/faq" },
]

export function LandingNav() {
    const { locale } = useI18n()
    const router = useRouter()
    const pathname = usePathname()
    const [activeSection, setActiveSection] = useState<string>("hero")
    const [isScrolled, setIsScrolled] = useState(false)

    // Labels for navigation items
    const labels: Record<string, string> = {
        product: locale === "zh" ? "产品" : "Product",
        demos: locale === "zh" ? "社区示例" : "Demos",
        features: locale === "zh" ? "功能" : "Features",
        howItWorks: locale === "zh" ? "使用方法" : "How It Works",
        pricing: locale === "zh" ? "定价" : "Pricing",
        faq: locale === "zh" ? "常见问题" : "FAQ",
    }

    useEffect(() => {
        const handleScroll = () => {
            // Check if scrolled past hero section
            setIsScrolled(window.scrollY > 50)

            // Only update active section if we are on the landing page
            const isLandingPage = pathname === `/${locale}` || pathname === `/${locale}/`
            if (!isLandingPage) return;

            // Determine active section based on scroll position
            // Only check internal links (no href)
            const sections = navItems
                .filter(item => !item.href)
                .map((item) => ({
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
        }

        window.addEventListener("scroll", handleScroll, { passive: true })
        handleScroll() // Initial check

        return () => window.removeEventListener("scroll", handleScroll)
    }, [pathname, locale])

    const scrollToSection = (id: string) => {
        const isLandingPage = pathname === `/${locale}` || pathname === `/${locale}/`

        if (!isLandingPage) {
            router.push(`/${locale}#${id}`)
            return
        }

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
        <nav className="fixed top-6 left-0 right-0 z-50 px-6 h-14 flex items-center pointer-events-none">
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between pointer-events-auto">
                {/* Left: Brand Logo */}
                <div
                    onClick={() => scrollToSection("hero")}
                    className="flex-shrink-0 cursor-pointer transition-opacity hover:opacity-80"
                >
                    <BrandLogo textClassName="text-lg font-semibold tracking-tight" />
                </div>

                {/* Center: Navigation Capsule */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
                    <div className={`
                        flex items-center gap-1 px-1.5 py-1.5 rounded-full 
                        bg-zinc-900/40 backdrop-blur-xl 
                        border border-white/5 
                        shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_4px_20px_-2px_rgba(0,0,0,0.2)]
                        transition-all duration-300
                        ${isScrolled ? "bg-zinc-900/80 shadow-lg border-white/10" : ""}
                    `}>
                        {navItems.slice(1).map((item) => (
                            item.href ? (
                                <Link
                                    key={item.id}
                                    href={`/${locale}${item.href}`}
                                    className={`
                                        px-4 py-2 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300
                                        text-zinc-400 hover:text-white hover:bg-white/5
                                    `}
                                >
                                    {labels[item.key]}
                                </Link>
                            ) : (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className={`
                                        px-4 py-2 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300
                                        ${activeSection === item.id
                                            ? "bg-white/10 text-white shadow-inner font-semibold"
                                            : "text-zinc-400 hover:text-white hover:bg-white/5"
                                        }
                                    `}
                                >
                                    {labels[item.key]}
                                </button>
                            )
                        ))}
                    </div>
                </div>

                {/* Right: Actions & Mobile Menu */}
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-3">
                        <LanguageInlineSelect />
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <LandingUserButton />
                    </div>

                    {/* Mobile Menu Trigger */}
                    <div className="md:hidden flex items-center gap-2">
                        <LanguageInlineSelect />
                        <LandingUserButton />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 -mr-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                                    <Menu className="w-5 h-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-black/90 border-white/10 backdrop-blur-xl">
                                {navItems.slice(1).map((item) => (
                                    item.href ? (
                                        <DropdownMenuItem
                                            key={item.id}
                                            asChild
                                        >
                                            <Link href={`/${locale}${item.href}`} className="cursor-pointer text-white/70 w-full">
                                                {labels[item.key]}
                                            </Link>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            key={item.id}
                                            onClick={() => scrollToSection(item.id)}
                                            className={`cursor-pointer ${activeSection === item.id ? "text-primary focus:text-primary" : "text-white/70"}`}
                                        >
                                            {labels[item.key]}
                                        </DropdownMenuItem>
                                    )
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </nav>
    )
}
