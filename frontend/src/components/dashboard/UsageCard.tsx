"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Zap, Database, TrendingUp } from "lucide-react"

type Profile = {
    tier: 'free' | 'pro' | string
    usage_count: number
    usage_limit: number
    extra_credits: number
}

export function UsageCard() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const { t } = useI18n()
    const supabase = createClient()

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single()

                if (error && error.code === 'PGRST116') {
                    // Profile not found (likely existing user before pricing), default to free
                    setProfile({
                        tier: 'free',
                        usage_count: 0,
                        usage_limit: 3,
                        extra_credits: 0
                    })
                } else if (data) {
                    setProfile(data as Profile)
                }
            }
        } catch (error) {
            console.error("Error fetching profile:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return null
    // removed if (!profile) return null to allow rendering default state if setProfile logic above works
    if (!profile) return null

    const usagePercent = Math.min((profile.usage_count / profile.usage_limit) * 100, 100)
    const isPro = profile.tier === 'pro'

    return (
        <Card className="border-white/10 bg-white/5 backdrop-blur-lg">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    {t("dashboard.usage.title") || "Usage & Quota"}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("dashboard.usage.monthly") || "Monthly Credits"}</span>
                            <span className="font-mono">{profile.usage_count} / {profile.usage_limit}</span>
                        </div>
                        <Progress value={usagePercent} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="p-3 rounded-lg bg-black/20 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                                <Database className="h-3 w-3" />
                                {t("dashboard.usage.plan") || "Plan"}
                            </div>
                            <div className={`font-semibold capitalize ${isPro ? 'text-emerald-400' : 'text-white'}`}>
                                {profile.tier}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                                <Zap className="h-3 w-3 text-blue-400" />
                                {t("dashboard.usage.extra") || "Extra"}
                            </div>
                            <div className="font-semibold text-blue-400">
                                {profile.extra_credits}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
