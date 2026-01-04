"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { PlayCircle, Sparkles, Loader2 } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { createClient } from "@/lib/supabase"

// Demo tasks are managed via is_demo field in the database
// No hardcoded IDs needed - just set is_demo = true in Supabase

export type TaskOutput = {
    kind: string
    content: string | object
}

export type Task = {
    id: string
    video_url: string
    video_title?: string
    thumbnail_url?: string
    status: string
    created_at: string
    author?: string
    author_image_url?: string
    task_outputs?: TaskOutput[]
}

const CATEGORY_MAP: Record<string, string> = {
    tutorial: "教程",
    interview: "访谈",
    monologue: "独白",
    news: "新闻",
    review: "评测",
    finance: "财经",
    narrative: "叙事",
    casual: "随笔",
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

const CATEGORY_STYLES: Record<string, string> = {
    tutorial: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    interview: "bg-violet-500/10 text-violet-500 border-violet-500/20",
    monologue: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    news: "bg-red-500/10 text-red-500 border-red-500/20",
    review: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    finance: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    narrative: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    casual: "bg-slate-500/10 text-slate-500 border-slate-500/20",
}

function TemplateCard({ task }: { task: Task }) {
    const router = useRouter()
    const { t } = useI18n()
    const platform = getPlatformFromUrl(task.video_url)
    const showAuthor = task.author && task.author !== "Unknown"

    // Extract category from task_outputs
    let categoryLabel = ""
    let categoryKey = ""
    if (task.task_outputs) {
        const classificationOutput = task.task_outputs.find(o => o.kind === 'classification')
        if (classificationOutput && classificationOutput.content) {
            try {
                const content = typeof classificationOutput.content === 'string'
                    ? JSON.parse(classificationOutput.content)
                    : classificationOutput.content
                const form = content.content_form
                // @ts-ignore - dynamic key access for i18n
                if (form) {
                    categoryKey = form
                    categoryLabel = t(`categories.${form}`) || form
                    // Fallback to English/Code if translation missing/key matches default
                    if (categoryLabel.startsWith("categories.")) categoryLabel = form
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
    }

    const badgeStyle = (categoryKey && CATEGORY_STYLES[categoryKey])
        ? CATEGORY_STYLES[categoryKey]
        : "bg-primary/10 text-primary border-primary/20"

    return (
        <div
            onClick={() => router.push(`/tasks/${task.id}`)}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-sm cursor-pointer transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(62,207,142,0.15)] hover:scale-[1.02] h-full"
        >
            {/* Thumbnail Area */}
            <div className="relative aspect-video w-full overflow-hidden bg-black/40 shrink-0">
                {task.thumbnail_url ? (
                    <Image
                        src={task.thumbnail_url}
                        alt={task.video_title || "Video thumbnail"}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                        unoptimized
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

                {/* Author Info & Category */}
                <div className="mt-auto flex items-center gap-2 min-h-[20px]">
                    {showAuthor ? (
                        <>
                            {task.author_image_url ? (
                                <div className="relative h-5 w-5 shrink-0 rounded-full overflow-hidden border border-white/10">
                                    <Image
                                        src={task.author_image_url}
                                        alt={task.author || "Author"}
                                        fill
                                        className="object-cover"
                                        referrerPolicy="no-referrer"
                                        unoptimized
                                    />
                                </div>
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
                        /* Maintain height schema if no author, but still might want category */
                        <div className="h-5" />
                    )}

                    {/* Category Badge (Bottom Right of Content) */}
                    {categoryLabel && (
                        <div className="ml-auto flex shrink-0">
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium border whitespace-nowrap shadow-sm ${badgeStyle}`}>
                                {categoryLabel}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function CommunityTemplates({ limit, showHeader = true, initialTasks = [] }: { limit?: number, showHeader?: boolean, initialTasks?: Task[] }) {
    const { t } = useI18n()
    const [tasks, setTasks] = useState<Task[]>(initialTasks)
    const [loading, setLoading] = useState(initialTasks.length === 0)
    const supabase = createClient()

    useEffect(() => {
        if (initialTasks.length > 0) {
            setLoading(false)
            return
        }
        async function fetchDemoTasks() {
            setLoading(true)
            // Query tasks where is_demo = true (managed in database)
            // Also fetch task_outputs to get classification
            let query = supabase
                .from('tasks')
                .select(`
                    id, 
                    video_url, 
                    video_title, 
                    thumbnail_url, 
                    status, 
                    created_at, 
                    author, 
                    author_image_url,
                    task_outputs (
                        kind,
                        content
                    )
                `)
                .eq('is_demo', true)
                .eq('status', 'completed')
                .order('created_at', { ascending: false })

            if (limit) {
                query = query.limit(limit)
            }

            // Explicitly cast the response to handle the joined data structure if TS complains,
            // or let inference work. The return type implies the structure.
            const { data, error } = await query

            if (data) {
                // We might need to map the data if Supabase types are strict, 
                // but usually the JS client returns what's asked.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setTasks(data as any as Task[])
            } else if (error) {
                console.error("Error fetching demo tasks:", error)
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
            {showHeader && (
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        {t("dashboard.communityExamples") || "Community Examples"}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                        {t("dashboard.communityExamplesHint") || "Try these ready-made examples"}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tasks.map((task) => (
                    <TemplateCard key={task.id} task={task} />
                ))}
            </div>
        </div>
    )
}
