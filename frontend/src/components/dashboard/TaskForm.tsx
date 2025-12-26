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
import { Sparkles, Video } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"
import { useI18n } from "@/components/i18n/I18nProvider"
import { SUPPORTED_LOCALES, LOCALE_LABEL } from "@/lib/i18n"

export function TaskForm() {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                alert(t("taskForm.pleaseLogin"))
                setLoading(false)
                return
            }

            const formData = new FormData()

            // Normalize URL
            let finalUrl = url.trim()
            if (!finalUrl.match(/^https?:\/\//i)) {
                finalUrl = `https://${finalUrl}`
            }

            formData.append("video_url", finalUrl)
            formData.append("summary_language", language)

            const res = await ApiClient.processVideo(formData, session.access_token)

            setUrl("")
            router.refresh()
            // Redirect to the newly created task
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

    return (
        <Card className="w-full glass">
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
