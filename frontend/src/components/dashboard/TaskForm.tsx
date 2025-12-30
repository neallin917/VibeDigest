"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Sparkles, Video, ArrowRight } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"
import { useI18n } from "@/components/i18n/I18nProvider"
import { SUPPORTED_LOCALES, LOCALE_LABEL } from "@/lib/i18n"

import { cn } from "@/lib/utils"

const SAMPLE_URL = "https://www.youtube.com/watch?v=Get7K950Jk8"

export function TaskForm({ simple = false, className }: { simple?: boolean, className?: string }) {
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const [showQuotaDialog, setShowQuotaDialog] = useState(false)
    const [mounted, setMounted] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const { t, locale } = useI18n()

    const [language, setLanguage] = useState<string>(locale)

    // Sync task language with system locale changes
    useEffect(() => {
        setLanguage(locale)
        setMounted(true)
    }, [locale])

    // Restore pending task from localStorage
    useEffect(() => {
        const pendingUrl = localStorage.getItem("pendingTask_url")
        const pendingLang = localStorage.getItem("pendingTask_lang")

        if (pendingUrl) {
            setUrl(pendingUrl)
            if (pendingLang) setLanguage(pendingLang)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                localStorage.setItem("pendingTask_url", url)
                localStorage.setItem("pendingTask_lang", language)
                router.push("/login")
                return
            }

            const formData = new FormData()

            let finalUrl = url.trim()
            if (!finalUrl.match(/^https?:\/\//i)) {
                finalUrl = `https://${finalUrl}`
            }

            formData.append("video_url", finalUrl)
            formData.append("summary_language", language)

            const res = await ApiClient.processVideo(formData, session.access_token)

            localStorage.removeItem("pendingTask_url")
            localStorage.removeItem("pendingTask_lang")

            setUrl("")
            router.refresh()
            if (res?.task_id) {
                router.push(`/tasks/${res.task_id}`)
            }

        } catch (error: unknown) {
            console.error(error)
            const errorMsg = error instanceof Error ? error.message : String(error)
            if (errorMsg.includes("Quota exceeded") || errorMsg.includes("insufficient credits")) {
                setShowQuotaDialog(true)
            } else {
                alert(errorMsg)
            }
        } finally {
            setLoading(false)
        }
    }

    if (simple) {
        return (
            <div className={cn("relative w-full max-w-3xl mx-auto flex flex-col items-center", className)}>
                {/* Outer Glow Container */}
                <div className="relative w-full group">
                    {/* Animated Glow Background - softer teal tones */}
                    <div className="absolute -inset-1 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-teal-600/20 via-emerald-700/15 to-teal-600/20 blur-xl opacity-50 group-hover:opacity-70 transition-all duration-700" />
                    <div className="absolute -inset-0.5 rounded-[1.8rem] md:rounded-[2.3rem] bg-gradient-to-br from-teal-700/15 to-emerald-800/15 blur-md" />

                    {/* Main Card */}
                    <div className="relative rounded-2xl md:rounded-[2rem] bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 p-6 md:p-8 backdrop-blur-2xl shadow-2xl shadow-black/20">
                        {/* Inner gradient overlay */}
                        <div className="absolute inset-0 rounded-2xl md:rounded-[2rem] bg-gradient-to-br from-teal-900/10 via-transparent to-emerald-900/10 pointer-events-none" />

                        {/* Content */}
                        <div className="relative space-y-5">
                            {/* Greeting inside card */}
                            <p className="text-base md:text-lg text-white/70 text-center font-medium">
                                {t("landing.greeting") || "Drop a podcast or video. We'll handle the rest."}
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Input Container */}
                                <div className="relative rounded-xl md:rounded-2xl bg-black/60 border border-white/10 p-3 md:p-4 shadow-inner transition-all duration-300 focus-within:border-primary/40 focus-within:bg-black/70">
                                    {/* URL Input Row */}
                                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                        <Video className="h-4 w-4 md:h-5 md:w-5 text-primary/70 shrink-0" />
                                        <Input
                                            placeholder={t("taskForm.urlPlaceholder")}
                                            className="border-0 bg-transparent h-9 md:h-12 text-sm md:text-lg text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 shadow-none min-w-0 truncate"
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            disabled={loading}
                                        />
                                    </div>

                                    {/* Sample URL */}
                                    <button
                                        type="button"
                                        className="mt-2 pl-8 text-xs text-white/30 hover:text-primary transition-colors text-left"
                                        onClick={() => setUrl(SAMPLE_URL)}
                                    >
                                        Try: youtube.com/watch?v=Get7K950Jk8
                                    </button>
                                </div>

                                {/* Actions Row */}
                                <div className="flex items-center justify-between gap-3 pt-1">
                                    {/* Language Selector */}
                                    <div className="shrink-0">
                                        {mounted ? (
                                            <Select value={language} onValueChange={setLanguage}>
                                                <SelectTrigger className="h-12 px-4 bg-black/50 border-white/10 hover:bg-black/70 hover:border-white/20 rounded-xl focus:ring-0 focus:ring-offset-0 gap-2 text-white/80 transition-all">
                                                    <span className="text-[10px] uppercase font-semibold text-white/40">Output</span>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent align="start" className="glass border-white/10">
                                                    {SUPPORTED_LOCALES.map((localeKey) => (
                                                        <SelectItem key={localeKey} value={localeKey}>
                                                            {LOCALE_LABEL[localeKey]}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="w-32 h-12 bg-black/50 rounded-xl" />
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        size="default"
                                        disabled={loading}
                                        className="h-11 md:h-12 px-6 md:px-8 rounded-xl bg-primary text-black font-bold hover:bg-emerald-400 shadow-[0_0_25px_rgba(62,207,142,0.2)] hover:shadow-[0_0_30px_rgba(62,207,142,0.35)] transition-all duration-300 hover:scale-[1.02]"
                                    >
                                        {loading ? (
                                            <Sparkles className="animate-spin h-5 w-5" />
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                {t("taskForm.generate")} <ArrowRight className="h-4 w-4" />
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                <Dialog open={showQuotaDialog} onOpenChange={setShowQuotaDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("taskForm.quotaExceeded.title")}</DialogTitle>
                            <DialogDescription>
                                {t("taskForm.quotaExceeded.description")}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowQuotaDialog(false)}>
                                {t("taskForm.quotaExceeded.cancel")}
                            </Button>
                            <Button onClick={() => router.push("/settings/pricing")}>
                                {t("taskForm.quotaExceeded.confirm")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    return (
        <Card className={cn("w-full glass", className)}>
            <CardHeader className="pb-2">
                <CardDescription className="text-base">
                    {t("taskForm.subtitle")}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-3">
                        <div className="relative">
                            <Video className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder={t("taskForm.urlPlaceholder")}
                                className="pl-9 h-11 bg-black/20"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-end gap-3">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={loading}
                                className="flex-1 bg-primary text-black font-semibold hover:bg-primary/90 shadow-[0_0_15px_rgba(62,207,142,0.4)] transition-all"
                            >
                                {loading ? t("taskForm.processing") : t("taskForm.generate")}
                            </Button>

                            <div className="w-[150px] sm:w-[220px] space-y-1">
                                <div className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                                    {t("taskForm.summaryLanguage")}
                                </div>
                                {mounted ? (
                                    <Select value={language} onValueChange={setLanguage}>
                                        <SelectTrigger
                                            className="w-full h-11 bg-black/20 border-white/10 hover:bg-black/25"
                                            size="default"
                                        >
                                            <SelectValue placeholder={t("taskForm.summaryLanguage")} />
                                        </SelectTrigger>
                                        <SelectContent align="start">
                                            {SUPPORTED_LOCALES.map((localeKey) => (
                                                <SelectItem key={localeKey} value={localeKey}>
                                                    {LOCALE_LABEL[localeKey]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="w-full h-11 bg-black/20 border border-white/10 rounded-md" />
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </CardContent>

            <Dialog open={showQuotaDialog} onOpenChange={setShowQuotaDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("taskForm.quotaExceeded.title")}</DialogTitle>
                        <DialogDescription>
                            {t("taskForm.quotaExceeded.description")}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowQuotaDialog(false)}>
                            {t("taskForm.quotaExceeded.cancel")}
                        </Button>
                        <Button onClick={() => router.push("/settings/pricing")}>
                            {t("taskForm.quotaExceeded.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card >
    )
}
