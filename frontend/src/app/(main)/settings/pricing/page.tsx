"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useI18n } from "@/components/i18n/I18nProvider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Check, Loader2, CreditCard, Database, Zap } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"
import { cn } from "@/lib/utils"
import { UsageCard } from "@/components/dashboard/UsageCard"

type Profile = {
    tier: 'free' | 'pro' | string
    usage_count: number
    usage_limit: number
    extra_credits: number
}

// Price IDs
const PRO_MONTHLY_PRICE_ID = "price_1ShU6GP16NRNsVf5dcAqHHDV"
const PRO_ANNUAL_PRICE_ID = "price_1ShVNXP16NRNsVf56kArMPa4"
const CREDIT_PACK_PRICE_ID = "price_1ShU6pP16NRNsVf5EdlEFgOE"

export default function PricingPage() {
    const { t } = useI18n()
    const [isAnnual, setIsAnnual] = useState(true)
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card')
    const [loading, setLoading] = useState(false)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [supabase] = useState(() => createClient())

    const [mounted, setMounted] = useState(false)

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single()
            setProfile(data as Profile)
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

            let url = ""
            if (paymentMethod === 'crypto') {
                const res = await ApiClient.createCryptoCharge(priceId, session.access_token)
                url = res.url
            } else {
                const res = await ApiClient.createCheckoutSession(priceId, session.access_token)
                url = res.url
            }

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

    const freeFeatureKeys = [
        "pricing.free.features.f1",
        "pricing.free.features.f2",
        "pricing.free.features.f3",
        "pricing.free.features.f4",
        "pricing.free.features.f5",
    ] as const

    const proFeatureKeys = [
        "pricing.pro.features.f1",
        "pricing.pro.features.f2",
        "pricing.pro.features.f3",
    ] as const

    const topupFeatureKeys = [
        "pricing.topup.features.f1",
        "pricing.topup.features.f2",
        "pricing.topup.features.f3",
    ] as const

    return (
        <div className="space-y-8 max-w-5xl mx-auto py-8">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">{t("pricing.title")}</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    {t("pricing.subtitle")}
                </p>
            </div>

            {/* Usage & Quota (moved from Dashboard) */}
            <div className="max-w-md mx-auto">
                <UsageCard />
            </div>

            {/* Payment Method Toggle (after quota) */}
            <div className="flex flex-col items-center justify-center gap-2 pt-2">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                    {t("pricing.paymentMethod")}
                </span>
                <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-full border border-border/50">
                    <Button
                        variant={paymentMethod === 'card' ? 'secondary' : 'ghost'}
                        onClick={() => setPaymentMethod('card')}
                        className="rounded-full px-6 transition-all"
                        size="sm"
                    >
                        <CreditCard className="w-4 h-4 mr-2" />
                        {t("pricing.card")}
                    </Button>
                    <Button
                        variant={paymentMethod === 'crypto' ? 'secondary' : 'ghost'}
                        onClick={() => setPaymentMethod('crypto')}
                        className="rounded-full px-6 transition-all"
                        size="sm"
                    >
                        <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                        {t("pricing.crypto")}
                    </Button>
                </div>
                {paymentMethod === 'crypto' && (
                    <p className="text-xs text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20 animate-in fade-in slide-in-from-top-1">
                        {t("pricing.cryptoWarning")}
                    </p>
                )}
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
                            {freeFeatureKeys
                                .map((k) => t(k))
                                .filter((v) => v && !v.startsWith("pricing."))
                                .map((feature, i) => (
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
                            {proFeatureKeys
                                .map((k) => t(k))
                                .filter((v) => v && !v.startsWith("pricing."))
                                .map((feature, i) => (
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
                            {topupFeatureKeys
                                .map((k) => t(k))
                                .filter((v) => v && !v.startsWith("pricing."))
                                .map((feature, i) => (
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

            {/* Footer Links (Compliance) */}
            <div className="flex justify-center gap-6 text-sm text-muted-foreground underline pb-8">
                <Link href="/policies/refund" className="hover:text-foreground transition-colors">{t("pricing.policies.refund")}</Link>
                <Link href="/policies/terms" className="hover:text-foreground transition-colors">{t("pricing.policies.terms")}</Link>
            </div>
        </div>
    )
}

function PlusCircleIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /><path d="M12 8v8" /></svg>
    )
}
