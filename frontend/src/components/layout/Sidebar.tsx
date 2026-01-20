"use client"

import { useEffect, useMemo, useState } from "react"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Home, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase"
import { useI18n } from "@/components/i18n/I18nProvider"
import { FeedbackDialog } from "./FeedbackDialog"
import { NAV_ITEMS } from "@/components/layout/navItems"

import { BrandLogo } from "./BrandLogo"
import { ThemeToggle } from "@/components/ui/theme-toggle"

export function Sidebar({ onHide }: { onHide?: () => void }) {
    const pathname = usePathname()
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const supabase = useMemo(() => createClient(), [])
    const { t, locale } = useI18n()

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserEmail(user?.email || null)
        })
    }, [supabase])

    return (
        <div className="hidden md:flex h-dvh w-64 flex-col border-r backdrop-blur-xl relative z-10 shadow-xl shadow-black/5 dark:shadow-none bg-white/70 border-slate-200/60 dark:bg-black/40 dark:border-white/10">
            <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                    <Link href="/" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
                        <BrandLogo textClassName="text-lg" />
                    </Link>

                    {onHide ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("nav.hideSidebar")}
                            title={t("nav.hideSidebar")}
                            onClick={onHide}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="flex-1 px-4 py-2 space-y-1">
                {NAV_ITEMS.map((item) => {
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={(e) => {
                                if (!userEmail) {
                                    e.preventDefault()
                                    // Use router.push to navigate to login with next param
                                    // We need to import useRouter if not already available
                                    window.location.href = '/login'
                                }
                            }}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                                pathname === item.href
                                    ? "bg-primary/15 text-primary shadow-[0_0_15px_rgba(62,207,142,0.15)]"
                                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {t(item.key)}
                        </Link>
                    )
                })}
            </div>

            {/* 辅助功能区 */}
            <div className="px-4 py-3 border-t border-white/5">
                <div className="space-y-1">
                    <FeedbackDialog />
                    <Button
                        variant="ghost"
                        asChild
                        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-white/5"
                    >
                        <Link href="/">
                            <Home className="h-4 w-4" />
                            {t("nav.backToHome")}
                        </Link>
                    </Button>
                </div>
            </div>

            {/* 用户卡片区 - 下拉菜单设计 */}
            <div className="p-4 border-t border-sidebar-border flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-full flex items-center gap-3 p-3 rounded-full bg-sidebar-accent/50 border border-sidebar-border hover:bg-sidebar-accent hover:border-sidebar-accent-foreground/10 transition-all">
                                {/* 用户头像 */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                                    {userEmail?.charAt(0).toUpperCase() || "U"}
                                </div>
                                {/* 用户邮箱 */}
                                <p className="flex-1 text-left text-xs text-sidebar-foreground truncate">
                                    {userEmail || "Guest"}
                                </p>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-56 glass border-sidebar-border">
                            <div className="px-3 py-2 border-b border-sidebar-border">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {userEmail?.split('@')[0] || "User"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                            </div>
                            <DropdownMenuItem
                                onClick={async () => {
                                    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
                                        window.google.accounts.id.disableAutoSelect()
                                    }
                                    await supabase.auth.signOut()
                                    window.location.href = '/'
                                }}
                                className="text-red-400 focus:text-red-400 cursor-pointer"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                {t("auth.logout")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent rounded-full h-10 w-10 flex-shrink-0 border border-sidebar-border" />
            </div>
        </div>
    )
}
