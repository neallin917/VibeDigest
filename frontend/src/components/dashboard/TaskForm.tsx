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
import { Sparkles, Video } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"
import { useI18n } from "@/components/i18n/I18nProvider"
import { SUPPORTED_LOCALES, LOCALE_LABEL } from "@/lib/i18n"

export function TaskForm() {
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const { t, locale } = useI18n()

    const [language, setLanguage] = useState<string>(locale)

    // Sync task language with system locale changes
    useEffect(() => {
        setLanguage(locale)
    }, [locale])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                alert(t("taskForm.pleaseLogin")) // In real app, redirect to login
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
            formData.append("summary_language", "zh") // Default to Chinese as per original

            formData.append("translate_targets", JSON.stringify([language]))

            const res = await ApiClient.processVideo(formData, session.access_token)
            console.log("Task Created:", res)

            setUrl("")
            router.refresh() // Refresh server components or trigger SWR revalidation
            // Ideally we redirect to detail or show a toast

        } catch (error: unknown) {
            console.error(error)
            alert(error instanceof Error ? error.message : String(error))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="w-full glass">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="text-primary h-6 w-6" />
                    {t("taskForm.title")}
                </CardTitle>
                <CardDescription>
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
                                    {t("taskForm.translateTo")}
                                </div>
                                <Select value={language} onValueChange={setLanguage}>
                                    <SelectTrigger
                                        className="w-full h-11 bg-black/20 border-white/10 hover:bg-black/25"
                                        size="default"
                                    >
                                        <SelectValue placeholder={t("taskForm.translateTo")} />
                                    </SelectTrigger>
                                    <SelectContent align="start">
                                        {SUPPORTED_LOCALES.map((localeKey) => (
                                            <SelectItem key={localeKey} value={localeKey}>
                                                {LOCALE_LABEL[localeKey]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
