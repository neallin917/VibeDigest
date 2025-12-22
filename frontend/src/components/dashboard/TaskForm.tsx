"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sparkles, Video } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ApiClient } from "@/lib/api"

export function TaskForm() {
    const [url, setUrl] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    // Simple state for checkboxes
    const [summary, setSummary] = useState(true)
    const [languages, setLanguages] = useState<string[]>([])

    const toggleLanguage = (lang: string) => {
        setLanguages(prev =>
            prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!url) return

        setLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                alert("Please login first!") // In real app, redirect to login
                setLoading(false)
                return
            }

            const formData = new FormData()
            formData.append("video_url", url)
            formData.append("summary_language", "zh") // Default to Chinese as per original

            // Filter out summary if not checked? Backend always does summary currently.
            // We act as if 'summary' checkbox controls visibility or priority? 
            // For now, let's just stick to backend default which includes summary.

            if (languages.length > 0) {
                formData.append("translate_targets", JSON.stringify(languages))
            }

            const res = await ApiClient.processVideo(formData, session.access_token)
            console.log("Task Created:", res)

            setUrl("")
            router.refresh() // Refresh server components or trigger SWR revalidation
            // Ideally we redirect to detail or show a toast

        } catch (error: any) {
            console.error(error)
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="w-full glass">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                    <Sparkles className="text-primary h-6 w-6" />
                    New Transcription
                </CardTitle>
                <CardDescription>
                    Paste a YouTube URL to generate an AI summary and translation.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Video className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="https://youtube.com/watch?v=..."
                                className="pl-9 h-11 bg-black/20"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <Button type="submit" size="lg" disabled={loading} className="bg-primary text-black font-semibold hover:bg-primary/90 shadow-[0_0_15px_rgba(62,207,142,0.4)] transition-all">
                            {loading ? "Processing..." : "Generate Magic"}
                        </Button>
                    </div>

                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={summary}
                                onChange={(e) => setSummary(e.target.checked)}
                            /> Summary
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={languages.includes("en")}
                                onChange={() => toggleLanguage("en")}
                            /> English
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={languages.includes("zh")}
                                onChange={() => toggleLanguage("zh")}
                            /> Chinese
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                            <input
                                type="checkbox"
                                className="accent-primary"
                                checked={languages.includes("ja")}
                                onChange={() => toggleLanguage("ja")}
                            /> Japanese
                        </label>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
