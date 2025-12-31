"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { PlayCircle, Sparkles, Clock, ArrowRight, Loader2 } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { createClient } from "@/lib/supabase"

// Demo tasks are managed via is_demo field in the database
// No hardcoded IDs needed - just set is_demo = true in Supabase

type Task = {
    id: string
    video_url: string
    video_title?: string
    thumbnail_url?: string
    status: string
    created_at: string
    author?: string
    author_image_url?: string
}

const getPlatformFromUrl = (url: string) => {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.toLowerCase()
        if (hostname.includes('bilibili')) return 'Bilibili'
        if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube'
        if (hostname.includes('tiktok')) return 'TikTok'
        if (hostname.includes('apple.com')) return 'Apple Podcast'
        if (hostname.includes('xiaoyuzhoufm.com')) return 'Xiaoyuzhou'
        return 'Web'
    } catch {
        return 'Link'
    }
}

function TemplateCard({ task }: { task: Task }) {
    const router = useRouter()
    const platform = getPlatformFromUrl(task.video_url)
    const showAuthor = task.author && task.author !== "Unknown"

    return (
        <div
            onClick={() => router.push(`/tasks/${task.id}`)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm cursor-pointer transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(62,207,142,0.15)] hover:scale-[1.02] h-full"
        >
            {/* Thumbnail Area */}
            <div className="relative aspect-video w-full overflow-hidden bg-black/40 shrink-0">
                {task.thumbnail_url ? (
                    <img
                        src={task.thumbnail_url}
                        alt={task.video_title || "Video thumbnail"}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <PlayCircle className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                )}

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Platform Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium text-white/80 border border-white/10">
                        {platform}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-snug group-hover:text-white transition-colors mb-2">
                    {task.video_title || task.video_url}
                </h3>

                {/* Author Info (replacing View Example) */}
                <div className="mt-auto flex items-center gap-2 min-h-[20px]">
                    {showAuthor ? (
                        <>
                            {task.author_image_url ? (
                                <img
                                    src={task.author_image_url}
                                    alt={task.author || "Author"}
                                    className="h-5 w-5 rounded-full object-cover border border-white/10 shrink-0"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
                                    <span className="text-[10px] text-white/70 font-bold leading-none">
                                        {(task.author || "U").charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span className="text-xs font-medium text-muted-foreground truncate leading-tight">
                                {task.author}
                            </span>
                        </>
                    ) : (
                        /* Maintain height for alignment if no author */
                        <div className="h-5" />
                    )}
                </div>
            </div>
        </div>
    )
}

export function CommunityTemplates({ limit }: { limit?: number }) {
    const { t } = useI18n()
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function fetchDemoTasks() {
            setLoading(true)
            // Query tasks where is_demo = true (managed in database)
            let query = supabase
                .from('tasks')
                .select('id, video_url, video_title, thumbnail_url, status, created_at, author, author_image_url')
                .eq('is_demo', true)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })

            if (limit) {
                query = query.limit(limit)
            }

            const { data } = await query

            if (data) {
                setTasks(data)
            }
            setLoading(false)
        }

        fetchDemoTasks()
    }, [limit])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Loading examples...</span>
            </div>
        )
    }

    if (tasks.length === 0) {
        return null
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t("dashboard.communityExamples") || "Community Examples"}
                </h2>
                <span className="text-xs text-muted-foreground">
                    {t("dashboard.communityExamplesHint") || "Try these ready-made examples"}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tasks.map((task) => (
                    <TemplateCard key={task.id} task={task} />
                ))}
            </div>
        </div>
    )
}
