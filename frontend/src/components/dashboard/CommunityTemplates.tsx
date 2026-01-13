"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { PlayCircle, Sparkles, Loader2 } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { createClient } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"

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

// Vibrant Neon Styles for Categories
const CATEGORY_STYLES: Record<string, string> = {
    tutorial: "bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
    interview: "bg-violet-500/10 text-violet-400 border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.15)]",
    monologue: "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
    news: "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.15)]",
    review: "bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.15)]",
    finance: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
    narrative: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]",
    casual: "bg-pink-500/10 text-pink-400 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.15)]",
}

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as any } }
}

function TemplateCard({ task }: { task: Task }) {
    const router = useRouter()
    const { t, locale } = useI18n()
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
        : "bg-white/5 text-white/70 border-white/10"

    return (
        <motion.div
            variants={itemVariants}
            onClick={() => {
                const slug = encodeURIComponent((task.video_title || "video").trim().replace(/\s+/g, '-'));
                router.push(`/${locale}/tasks/${task.id}/${slug}`)
            }}
            className="group relative flex flex-col overflow-hidden rounded-3xl bg-black/40 border border-white/5 cursor-pointer backdrop-blur-sm"
        >
            {/* Thumbnail Area with Portal Effect */}
            <div className="relative aspect-video w-full overflow-hidden">
                <div className="absolute inset-0 bg-neutral-900/50 z-0" />
                {task.thumbnail_url ? (
                    <Image
                        src={task.thumbnail_url}
                        alt={task.video_title || "Video thumbnail"}
                        fill
                        className="object-cover transition-all duration-700 group-hover:scale-110 group-hover:contrast-[1.1]"
                        referrerPolicy="no-referrer"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <PlayCircle className="h-12 w-12 text-white/20 group-hover:text-primary transition-colors duration-300" />
                    </div>
                )}

                {/* Gradient Overlay - Cinematic Fade */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />

                {/* Platform Badge - Floating */}
                <div className="absolute top-3 left-3 z-20">
                    <span className="flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 text-[10px] font-bold text-white/90 shadow-lg tracking-wide uppercase">
                        {platform}
                    </span>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative flex flex-1 flex-col p-4 pt-3 pb-5 z-20 -mt-2">
                <h3 className="font-bold text-white leading-tight line-clamp-2 mb-3 group-hover:text-primary transition-colors duration-300">
                    {task.video_title || task.video_url}
                </h3>

                {/* Author Info & Category */}
                <div className="mt-auto flex items-center justify-between gap-3">
                    {showAuthor ? (
                        <div className="flex items-center gap-2 min-w-0">
                            {task.author_image_url ? (
                                <div className="relative h-6 w-6 shrink-0 rounded-full overflow-hidden border border-white/20">
                                    <Image
                                        src={task.author_image_url}
                                        alt={task.author || "Author"}
                                        fill
                                        className="object-cover"
                                        referrerPolicy="no-referrer"
                                        sizes="24px"
                                    />
                                </div>
                            ) : (
                                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <span className="text-[10px] text-white/70 font-bold leading-none">
                                        {(task.author || "U").charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <span className="text-xs font-medium text-white/60 truncate">
                                {task.author}
                            </span>
                        </div>
                    ) : (
                        /* Maintain height schema if no author, but still might want category */
                        <div className="h-6" />
                    )}

                    {/* Neon Category Badge */}
                    {categoryLabel && (
                        <div className="shrink-0">
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${badgeStyle}`}>
                                {categoryLabel}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hover Glow Border */}
            <div className="absolute inset-0 border border-white/10 rounded-3xl pointer-events-none group-hover:border-primary/30 transition-colors duration-500" />
            <div className="absolute -inset-px bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500 -z-10 rounded-3xl" />
        </motion.div>
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

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground/50">
                <Loader2 className="h-6 w-6 animate-spin mr-3 text-primary" />
                <span className="text-sm font-medium tracking-wide">INITIALIZING DATABASE...</span>
            </div>
        )
    }

    if (tasks.length === 0) {
        return null
    }

    return (
        <div className="space-y-6">
            {showHeader && (
                <div className="flex items-end justify-between px-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Sparkles className="h-5 w-5 text-primary" />
                            {t("dashboard.communityExamples") || "Community"}
                        </h2>
                        <span className="text-sm text-white/40 font-medium tracking-wide">
                            {t("dashboard.communityExamplesHint") || "Explore what others are creating"}
                        </span>
                    </div>
                </div>
            )}

            <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {tasks.map((task) => (
                    <TemplateCard key={task.id} task={task} />
                ))}
            </motion.div>
        </div>
    )
}
