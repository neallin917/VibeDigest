"use client"

import { useEffect, useMemo, useState } from "react"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useI18n } from "@/components/i18n/I18nProvider"
import { FeedbackDialog } from "./FeedbackDialog"
import { NAV_ITEMS } from "@/components/layout/navItems"
import { Heading, Text } from "@/components/ui/typography"

export function Sidebar({ onHide }: { onHide?: () => void }) {
    const pathname = usePathname()
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const supabase = useMemo(() => createClient(), [])
    const { t } = useI18n()

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserEmail(user?.email || null)
        })
    }, [supabase])

    return (
        <div className="hidden md:flex h-dvh w-64 flex-col border-r border-white/5 bg-black/60 backdrop-blur-2xl relative z-10 bg-grid-dense">
            <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Text as="span" className="text-primary" weight="semibold">
                            ⚡
                        </Text>
                        <Heading as="h1" variant="h3" className="m-0 truncate">
                            {t("brand.appName")}
                        </Heading>
                    </div>

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
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                            pathname === item.href
                                ? "bg-[#7377DD]/15 text-[#A78BFA] shadow-[0_0_15px_rgba(115,119,221,0.15)]"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {t(item.key)}
                    </Link>
                ))}
            </div>

            <div className="p-4 border-t border-white/5 space-y-4">
                {userEmail && (
                    <div className="px-1 py-2 mb-2 text-xs text-muted-foreground truncate border-b border-white/5">
                        {userEmail}
                    </div>
                )}

                <FeedbackDialog />

                <Button
                    variant="ghost"
                    onClick={async () => {
                        await supabase.auth.signOut()
                        window.location.href = '/'
                    }}
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                >
                    <LogOut className="h-4 w-4" />
                    {t("auth.logout")}
                </Button>
            </div>
        </div>
    )
}
