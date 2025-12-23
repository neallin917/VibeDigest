"use client"

import { useState, useEffect } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Check, Loader2, CreditCard, Zap, Database } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"
import { cn } from "@/lib/utils"

// Price IDs
const PRO_MONTHLY_PRICE_ID = "price_1ShU6GP16NRNsVf5dcAqHHDV"
const PRO_ANNUAL_PRICE_ID = "price_1ShVNXP16NRNsVf56kArMPa4"
const CREDIT_PACK_PRICE_ID = "price_1ShU6pP16NRNsVf5EdlEFgOE"

export default function PricingPage() {
    const { t } = useI18n()
    const [isAnnual, setIsAnnual] = useState(true)
    const [loading, setLoading] = useState(false)
    const [profile, setProfile] = useState<any>(null)
    const [supabase] = useState(() => createClient())

    const [mounted, setMounted] = useState(false)

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
            setProfile(data)
        }
    }

    useEffect(() => {
        setMounted(true)
        fetchProfile()
    }, [])

    if (!mounted) {
        return null // Prevent hydration mismatch by rendering only on client
    }

    const handleCheckout = async (priceId: string) => {
        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const { url } = await ApiClient.createCheckoutSession(priceId, session.access_token)
            if (url) {
                window.location.href = url
            }
        } catch (error) {
            console.error("Checkout failed:", error)
            alert("Failed to start checkout. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    const isPro = profile?.tier === 'pro'

    return (
        <div className="space-y-8 max-w-5xl mx-auto py-8">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {t("pricing.subtitle")}
                </p>

                <div className="flex items-center justify-center gap-4 pt-4" title="2 months free with annual billing">
                    {/* Toggle moved to Pro Card */}
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* FREE TIER */}
                <Card className={cn("relative flex flex-col h-full border-border/50 bg-background/50 backdrop-blur-sm", !isPro && "border-primary/20 bg-primary/5")}>
                    {!isPro && (
                        <div className="absolute top-0 right-0 p-4">
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                {t("pricing.currentPlan")}
                            </Badge>
                        </div>
                    )}
                    <CardHeader>
                        <CardTitle className="text-2xl">{t("pricing.free.title")}</CardTitle>
                        <CardDescription>{t("pricing.free.desc")}</CardDescription>
                        <div className="mt-4">
                            <span className="text-4xl font-bold">{t("pricing.free.price")}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <ul className="space-y-3 text-sm">
                            {(Object.values(t("pricing.free.features") as any) as string[]).map((feature, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-muted-foreground" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" variant="outline" disabled>
                            {isPro ? "Included" : t("pricing.currentPlan")}
                        </Button>
                    </CardFooter>
                </Card>

                {/* PRO TIER */}
                <Card className={cn("relative flex flex-col h-full border-emerald-500/50 bg-emerald-950/10 backdrop-blur-md shadow-2xl shadow-emerald-500/10", isPro && "ring-2 ring-emerald-500")}>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-3 py-1 text-xs">
                            MOST POPULAR
                        </Badge>
                    </div>
                    {isPro && (
                        <div className="absolute top-0 right-0 p-4">
                            <Badge className="bg-emerald-500 text-white">Active</Badge>
                        </div>
                    )}
                    <CardHeader className="relative">
                        <div className="flex justify-between items-center mb-2">
                            <CardTitle className="text-2xl">{t("pricing.pro.title")}</CardTitle>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-[10px] font-semibold tracking-wider", isAnnual ? "text-emerald-500" : "text-muted-foreground")}>
                                    {t("pricing.pro.annual")}
                                </span>
                                <Switch checked={isAnnual} onCheckedChange={setIsAnnual} className="scale-75 data-[state=checked]:bg-emerald-500" />
                            </div>
                        </div>

                        <div className="mt-2 flex items-baseline gap-2">
                            {isAnnual && (
                                <span className="text-2xl text-muted-foreground line-through font-medium">
                                    {t("pricing.pro.price")}
                                </span>
                            )}
                            <span className="text-5xl font-bold">
                                {isAnnual ? t("pricing.pro.annualPrice") : t("pricing.pro.price")}
                            </span>
                            <span className="text-muted-foreground text-sm">{t("pricing.pro.unit")}</span>
                        </div>
                        {isAnnual && <p className="text-xs text-muted-foreground mt-1">{t("pricing.pro.desc")}</p>}
                    </CardHeader>
                    <CardContent className="flex-1">
                        <ul className="space-y-3 text-sm">
                            {(Object.values(t("pricing.pro.features") as any) as string[]).map((feature, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    <Check className="h-4 w-4 text-emerald-500" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        {isPro ? (
                            <Button className="w-full bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 rounded-full h-12" onClick={() => alert("Manage Subscription via Stripe Portal coming soon!")}>
                                {t("pricing.pro.manage")}
                            </Button>
                        ) : (
                            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-12 text-base font-semibold shadow-lg shadow-emerald-500/20"
                                onClick={() => handleCheckout(isAnnual ? PRO_ANNUAL_PRICE_ID : PRO_MONTHLY_PRICE_ID)}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {t("pricing.pro.button")}
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* TOP UP */}
                <Card className="relative flex flex-col h-full border-border/50 bg-background/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-2xl">{t("pricing.topup.title")}</CardTitle>
                        <CardDescription>{t("pricing.topup.desc")}</CardDescription>
                        <div className="mt-4">
                            <span className="text-4xl font-bold">{t("pricing.topup.price")}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <ul className="space-y-3 text-sm">
                            {(Object.values(t("pricing.topup.features") as any) as string[]).map((feature, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-blue-400" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" variant="secondary" onClick={() => handleCheckout(CREDIT_PACK_PRICE_ID)} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircleIcon />}
                            {t("pricing.topup.button")}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {profile && (
                <div className="mt-12 p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg">
                    <h3 className="text-lg font-semibold mb-4">Your Usage</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-black/20">
                            <div className="text-sm text-muted-foreground">Current Plan</div>
                            <div className="text-xl font-mono capitalize text-emerald-400">{profile.tier}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-black/20">
                            <div className="text-sm text-muted-foreground">Monthly Usage</div>
                            <div className="text-xl font-mono">{profile.usage_count} / {profile.usage_limit}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-black/20">
                            <div className="text-sm text-muted-foreground">Extra Credits</div>
                            <div className="text-xl font-mono text-blue-400">{profile.extra_credits}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function PlusCircleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
    )
}
