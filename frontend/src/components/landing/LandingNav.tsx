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
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ThemeToggle } from "@/components/ui/theme-toggle"

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
                    <BrandLogo textClassName="text-lg font-semibold tracking-tight text-slate-900 dark:text-white" />
                </div>

                {/* Center: Navigation Capsule */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:block">
                    <div className={cn(
                        "flex items-center gap-1 px-1.5 py-1.5 rounded-full backdrop-blur-xl transition-all duration-300",
                        // Light mode
                        "bg-white/70 shadow-lg ring-1 ring-white/60",
                        // Dark mode
                        "dark:bg-zinc-900/40 dark:ring-white/5 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_4px_20px_-2px_rgba(0,0,0,0.2)]",
                        // Scrolled state
                        isScrolled && "bg-white/90 shadow-xl ring-slate-200/50 dark:bg-zinc-900/80 dark:shadow-lg dark:ring-white/10"
                    )}>
                        {navItems.slice(1).map((item) => (
                            item.href ? (
                                <Link
                                    key={item.id}
                                    href={`/${locale}${item.href}`}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300",
                                        "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
                                        "dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
                                    )}
                                >
                                    {labels[item.key]}
                                </Link>
                            ) : (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300",
                                        activeSection === item.id
                                            ? "bg-indigo-100 text-indigo-700 shadow-inner font-semibold dark:bg-white/10 dark:text-white"
                                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5"
                                    )}
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
                        <ThemeToggle className="h-9 w-9 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10" />
                        <div className="h-4 w-px bg-slate-300 dark:bg-white/10 mx-1" />
                        <LandingUserButton />
                    </div>

                    {/* Mobile Menu Trigger */}
                    <div className="md:hidden flex items-center gap-2">
                        <LanguageInlineSelect />
                        <ThemeToggle className="h-8 w-8 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/10" />
                        <LandingUserButton />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 -mr-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 transition-colors">
                                    <Menu className="w-5 h-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-white/90 dark:bg-black/90 border-slate-200 dark:border-white/10 backdrop-blur-xl">
                                {navItems.slice(1).map((item) => (
                                    item.href ? (
                                        <DropdownMenuItem
                                            key={item.id}
                                            asChild
                                        >
                                            <Link href={`/${locale}${item.href}`} className="cursor-pointer text-slate-700 dark:text-white/70 w-full">
                                                {labels[item.key]}
                                            </Link>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            key={item.id}
                                            onClick={() => scrollToSection(item.id)}
                                            className={`cursor-pointer ${activeSection === item.id ? "text-indigo-600 dark:text-primary focus:text-indigo-600 dark:focus:text-primary" : "text-slate-700 dark:text-white/70"}`}
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
