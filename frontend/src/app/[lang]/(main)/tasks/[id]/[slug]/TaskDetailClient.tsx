"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { FileText, Subtitles, Copy, Check, Sparkles, PlayCircle, Quote, Zap, Languages, ChevronDown, Target, AlertTriangle, ArrowRight, X, UserMinus, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase"
// import ReactMarkdown from "react-markdown" // Lazy loaded below
import { useI18n } from "@/components/i18n/I18nProvider"
import { LOCALE_LABEL, type Locale } from "@/lib/i18n"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { VideoEmbed, supportsVideoEmbed } from "@/components/tasks/VideoEmbed"
import { AudioEmbed } from "@/components/tasks/AudioEmbed"
import { Heading } from "@/components/ui/typography"
import { TranscriptTimeline, buildTranscriptBlocks } from "@/components/tasks/TranscriptTimeline"
import { formatSeconds } from "@/components/tasks/transcript"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { SummaryShareButton } from "@/components/tasks/SummaryExportButton"
import { Bell, BellOff, Network } from "lucide-react"
import dynamic from 'next/dynamic'
import type { MindMapNode } from "@/components/tasks/MindMap"

const MindMap = dynamic(() => import("@/components/tasks/MindMap").then(mod => mod.MindMap), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[500px] border border-white/5 rounded-xl bg-[#1A1A1A] flex items-center justify-center text-muted-foreground">
            Loading Mind Map...
        </div>
    )
})

const Markdown = dynamic(() => import("react-markdown"), {
    loading: () => <div className="h-4 w-full animate-pulse bg-white/5 rounded" />
})

export type Task = {
    id: string
    video_url: string
    video_title: string
    thumbnail_url?: string
    status: string
    progress: number
    created_at: string
}

export type Output = {
    id: string
    kind: string // script, summary, translation, audio
    locale?: string
    status: string
    progress: number
    content: string
    error_message?: string
}

type ContentType = {
    content_form: string
    info_structure: string
    cognitive_goal: string
}

type StructuredSummaryV1 = {
    version: number
    language: string
    content_type?: ContentType
    overview: string
    keypoints: Array<{
        title: string
        detail: string
        evidence?: string
        startSeconds?: number
        endSeconds?: number
    }>
}

type ClassificationOutput = {
    content_form: string
    info_structure: string
    cognitive_goal: string
    confidence: number
}

type ComprehensionBriefResponse = {
    core_intent: string
    core_position: string
    key_insights: Array<{
        title: string
        new_perspective: string
        why_it_matters: string
    }>
    what_to_ignore: string[]
    target_audience: {
        who_benefits: string[]
        who_wont: string[]
    }
    reusable_takeaway: string
}

type MediaController = {
    seek: (seconds: number) => void
}

interface TaskDetailClientProps {
    id: string
    initialTask: Task | null
    initialOutputs: Output[]
}

// Feature flag for Learning Tab (set to true when ready for production)
const SHOW_LEARNING_TAB = false

export default function TaskDetailClient({ id, initialTask, initialOutputs }: TaskDetailClientProps) {
    const [task, setTask] = useState<Task | null>(initialTask)
    const [outputs, setOutputs] = useState<Output[]>(initialOutputs)
    // Default to summary (primary UX)
    const [activeTab, setActiveTab] = useState("summary")
    const [mediaController, setMediaController] = useState<MediaController | null>(null)
    const supabase = createClient()

    const { t, locale } = useI18n()
    const { permission, subscribeToTask, isSubscribed } = useTaskNotification()

    const handleNotifyClick = async () => {
        if (!id) return
        if (permission === 'denied') {
            alert(t("tasks.notificationPermissionDenied"))
            return
        }
        await subscribeToTask(id)
    }

    const videoRef = useRef<HTMLDivElement>(null)

    // IMPORTANT: keep hooks order stable across renders.
    const handleMediaReady = useCallback((ctrl: MediaController) => {
        setMediaController(ctrl)
    }, [])

    const handleSeek = useCallback((seconds: number) => {
        if (!mediaController) return
        try {
            mediaController.seek(seconds)
            if (videoRef.current) {
                videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        } catch {
            // ignore
        }
    }, [mediaController])

    const fetchTask = useCallback(async () => {
        const { data } = await supabase.from('tasks').select('*').eq('id', id).single()
        if (data) setTask(data)
    }, [id, supabase])

    const fetchOutputs = useCallback(async () => {
        const { data } = await supabase.from('task_outputs').select('*').eq('task_id', id)
        if (data) setOutputs(data)
    }, [id, supabase])

    useEffect(() => {
        if (!id) return
        // If we didn't get initial data (e.g. error or loading state passed), fetch it
        if (!initialTask) void fetchTask()
        if (initialOutputs.length === 0) void fetchOutputs()

        const taskChannel = supabase.channel(`task_${id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `id=eq.${id}`
            }, (payload: RealtimePostgresChangesPayload<Task>) => {
                setTask(payload.new as Task)
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'task_outputs',
                filter: `task_id=eq.${id}`
            }, () => {
                void fetchOutputs()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(taskChannel)
        }
    }, [id, supabase, fetchOutputs, fetchTask, initialTask, initialOutputs])

    if (!task) return <div className="p-10 text-center">{t("tasks.loadingTask")}</div>

    // Helper to find best matching output for current locale
    const getLocalizedOutput = (kind: string) => {
        if (!outputs.length) return undefined
        const kindOutputs = outputs.filter(o => o.kind === kind)
        if (!kindOutputs.length) return undefined

        // 1. Try exact locale match
        const match = kindOutputs.find(o => o.locale === locale)
        if (match) return match

        // 2. Try 'en' fallback
        const enMatch = kindOutputs.find(o => o.locale === 'en')
        if (enMatch) return enMatch

        // 3. Fallback to first available
        return kindOutputs[0]
    }

    const script = getLocalizedOutput('script')
    const summary = getLocalizedOutput('summary')
    const comprehensionBrief = getLocalizedOutput('comprehension_brief')
    // Source matches don't have multiple locales usually, but good to keep consistent if we add them
    const summarySource = outputs.find(o => o.kind === 'summary_source')
    const scriptRaw = outputs.find(o => o.kind === 'script_raw')
    const audio = outputs.find(o => o.kind === 'audio')
    const hasVideo = supportsVideoEmbed(task.video_url)

    const detectedLanguageCode = (() => {
        if (!scriptRaw?.content) return "unknown"
        try {
            const payload = JSON.parse(scriptRaw.content) as { language?: string }
            return (payload.language || "unknown").toLowerCase()
        } catch {
            return "unknown"
        }
    })()

    const detectedLanguageLabel = (() => {
        const key = `languages.${detectedLanguageCode}`
        const maybe = t(key)
        if (maybe === key) return detectedLanguageCode
        return maybe
    })()

    let audioUrl: string | null = null
    let audioCoverUrl: string | undefined = task.thumbnail_url
    if (audio?.content) {
        const raw = audio.content.trim()
        if (raw.startsWith("{")) {
            try {
                const parsed = JSON.parse(raw) as { audioUrl?: string; coverUrl?: string }
                if (parsed.audioUrl) audioUrl = parsed.audioUrl
                if (parsed.coverUrl) audioCoverUrl = parsed.coverUrl
            } catch {
                audioUrl = audio.content
            }
        } else {
            audioUrl = audio.content
        }
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto min-h-0 px-2 sm:px-4 md:px-0 pt-3 md:pt-6 pb-6">
                <div className="max-w-4xl mx-auto space-y-3 md:space-y-6">
                    <Card className="glass">
                        <CardHeader className="pb-3 p-3 sm:p-4 md:p-6">
                            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                                <div className="space-y-1">
                                    <Heading as="h1" variant="pageTitle">
                                        {task.video_title || task.video_url}
                                    </Heading>
                                </div>
                                {task.status !== "completed" && (
                                    <Badge variant={task.status === "error" ? "destructive" : "processing"} className="text-xs md:text-sm px-3 py-1 self-start">
                                        {task.status.toUpperCase()}
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
                            <div className="mb-4 md:mb-6" ref={videoRef}>
                                {hasVideo ? <VideoEmbed videoUrl={task.video_url} title={task.video_title} coverUrl={task.thumbnail_url} onReady={handleMediaReady} /> : null}
                                {!hasVideo && audio?.status === "completed" && audioUrl ? (
                                    <AudioEmbed audioUrl={audioUrl} title={task.video_title} coverUrl={audioCoverUrl} sourceUrl={task.video_url} onReady={handleMediaReady} />
                                ) : null}
                                {!hasVideo && (!audio || audio.status === "error") ? (
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        {t("tasks.audioUnavailable")}
                                    </div>
                                ) : null}
                            </div>

                            {(task.status === "processing" || task.status === "pending") && (
                                <TaskProgress
                                    task={task}
                                    isSubscribed={isSubscribed(task.id)}
                                    permission={permission}
                                    onNotify={handleNotifyClick}
                                    t={t}
                                />
                            )}

                            {task.status === "error" && (
                                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
                                    {t("tasks.taskError")}
                                </div>
                            )}

                            <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className={`grid w-full h-12 ${SHOW_LEARNING_TAB ? 'grid-cols-4' : 'grid-cols-3'}`}>
                                    <TabsTrigger value="summary" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                        <FileText className="hidden sm:block h-4 w-4" /> {t("tasks.tabSummary")}
                                    </TabsTrigger>
                                    {SHOW_LEARNING_TAB && (
                                        <TabsTrigger value="learning" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                            <Zap className="hidden sm:block h-4 w-4 text-emerald-400" /> {t("tasks.tabLearning")}
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="mindmap" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                        <Network className="hidden sm:block h-4 w-4" /> MindMap
                                    </TabsTrigger>
                                    <TabsTrigger value="script" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                        <Subtitles className="hidden sm:block h-4 w-4" /> {t("tasks.tabScript")}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="summary" className="mt-4 md:mt-6 space-y-4">
                                    <SummarySection
                                        taskTitle={task.video_title}
                                        outputs={outputs}
                                        summaryPlaceholder={t("tasks.summaryPlaceholder")}
                                        canSeek={Boolean(mediaController)}
                                        onSeek={handleSeek}
                                        t={t}
                                        locale={locale}
                                        coverUrl={task.thumbnail_url}
                                    />
                                </TabsContent>

                                {SHOW_LEARNING_TAB && (
                                    <TabsContent value="learning" className="mt-4 md:mt-6 outline-none">
                                        {comprehensionBrief?.status === 'completed' ? (
                                            <ComprehensionBriefSection content={comprehensionBrief.content} />
                                        ) : (
                                            <OutputCard output={comprehensionBrief} placeholder={t("tasks.summaryPlaceholder")} />
                                        )}
                                    </TabsContent>
                                )}

                                <TabsContent value="mindmap" className="mt-4 md:mt-6 space-y-4">
                                    <MindMapSection
                                        outputs={outputs}
                                        t={t}
                                        locale={locale}
                                    />
                                </TabsContent>

                                <TabsContent value="script" className="mt-4 md:mt-6 space-y-4">
                                    <FullScriptSection
                                        script={script}
                                        scriptRawContent={scriptRaw?.content}
                                        scriptPlaceholder={t("tasks.scriptPlaceholder")}
                                        detectedLanguageLabel={detectedLanguageLabel}
                                        canSeek={Boolean(mediaController)}
                                        onSeek={handleSeek}
                                        t={t}
                                    />
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

// ... All helper components (SummarySection, SummaryKeypointItem, FullScriptSection, OutputCard, stripRedundantTranscriptHeaders, TaskProgress, MindMapSection) remain exactly as they were, just copied over.
// For brevity in this tool call, I will include them.

function SummarySection({
    taskTitle,
    outputs,
    summaryPlaceholder,
    canSeek,
    onSeek,
    t,
    locale,
    coverUrl,
}: {
    taskTitle?: string
    outputs: Output[]
    summaryPlaceholder: string
    canSeek: boolean
    onSeek: (seconds: number) => void
    t: (key: string, vars?: Record<string, string | number>) => string
    locale: string
    coverUrl?: string
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isLangOpen, setIsLangOpen] = useState(false)

    // Get all available summary outputs
    const summaryOutputs = outputs.filter(o => o.kind === 'summary' && o.status === 'completed')
    const summarySource = outputs.find(o => o.kind === 'summary_source' && o.status === 'completed')
    const classificationOutput = outputs.find(o => o.kind === 'classification' && o.status === 'completed')

    // Parse structured summary
    const parseSummary = (output?: Output) => {
        if (!output?.content) return null
        try {
            const obj = JSON.parse(output.content) as StructuredSummaryV1
            if (!obj || typeof obj !== "object") return null
            if (typeof obj.overview !== "string") return null
            if (!Array.isArray(obj.keypoints)) return null
            return obj
        } catch {
            return null
        }
    }

    // Parse classification from standalone output
    const parseClassification = (output?: Output): ClassificationOutput | null => {
        if (!output?.content) return null
        try {
            return JSON.parse(output.content) as ClassificationOutput
        } catch {
            return null
        }
    }

    // Build available locales map: key -> { output, parsed, nativeLabel }
    // Key is the language code (e.g., 'en', 'zh') to deduplicate
    const availableLocales = useMemo(() => {
        const map = new Map<string, { output: Output; parsed: StructuredSummaryV1; isSource?: boolean }>()

        if (summarySource) {
            const parsed = parseSummary(summarySource)
            if (parsed) {
                const lang = (parsed.language || 'source').toLowerCase()
                map.set(lang, { output: summarySource, parsed, isSource: true })
            }
        }

        for (const output of summaryOutputs) {
            const parsed = parseSummary(output)
            if (parsed) {
                const lang = (parsed.language || output.locale || 'unknown').toLowerCase()
                if (!map.has(lang) || map.get(lang)?.isSource) {
                    map.set(lang, { output, parsed })
                }
            }
        }

        return map
    }, [summaryOutputs, summarySource])

    const initialLocale = useMemo(() => {
        if (availableLocales.has(locale)) return locale
        if (availableLocales.has('en')) return 'en'
        const keys = Array.from(availableLocales.keys())
        return keys[0] || 'en'
    }, [availableLocales, locale])

    const [selectedLocale, setSelectedLocale] = useState<string>(initialLocale)

    const current = availableLocales.get(selectedLocale) || availableLocales.get(initialLocale)
    const parsed = current?.parsed || null

    const classification = useMemo(() => {
        if (parsed?.content_type) {
            return parsed.content_type
        }
        if (classificationOutput) {
            const cls = parseClassification(classificationOutput)
            if (cls) return cls
        }
        return null
    }, [parsed, classificationOutput])

    const CLS_LABELS: Record<string, string> = {
        tutorial: `📚 ${t("categories.tutorial")}`,
        interview: `🎙️ ${t("categories.interview")}`,
        monologue: `🗣️ ${t("categories.monologue")}`,
        finance: `💰 ${t("categories.finance")}`,
        review: `⭐ ${t("categories.review")}`,
        news: `📰 ${t("categories.news")}`,
        narrative: `📖 ${t("categories.narrative")}`,
        casual: `☕ ${t("categories.casual")}`,
        hierarchical: "🌳",
        sequential: "➡️",
        argumentative: "⚖️",
        comparative: "🆚",
        narrative_arc: "📈",
        thematic: "🧩",
        qa_format: "❓",
        data_driven: "📊",
        understand: "🧠",
        decide: "🤔",
        execute: "🛠️",
        inspire: "✨",
        digest: "📝",
    }

    const keypointsTitle = useMemo(() => {
        const structure = classification?.info_structure
        if (!structure) return t("tasks.summaryStructured.keypointsTitle")

        const keyMap: Record<string, string> = {
            sequential: "tasks.summaryStructured.sequentialTitle",
            argumentative: "tasks.summaryStructured.argumentativeTitle",
            comparative: "tasks.summaryStructured.comparativeTitle",
            hierarchical: "tasks.summaryStructured.hierarchicalTitle",
            narrative_arc: "tasks.summaryStructured.narrativeArcTitle",
            thematic: "tasks.summaryStructured.thematicTitle",
            qa_format: "tasks.summaryStructured.qaFormatTitle",
            data_driven: "tasks.summaryStructured.dataDrivenTitle"
        }

        const key = keyMap[structure]
        return key ? t(key) : t("tasks.summaryStructured.keypointsTitle")
    }, [classification, t])

    const getLocaleLabel = (lang: string) => {
        if (lang in LOCALE_LABEL) {
            return LOCALE_LABEL[lang as Locale]
        }
        return lang.toUpperCase()
    }

    const availableLocalesList = Array.from(availableLocales.keys())
    const showLanguageSelector = availableLocalesList.length > 1

    const toMarkdown = (data: StructuredSummaryV1) => {
        const lines: string[] = []
        if (taskTitle) lines.push(`# ${taskTitle}`, "")

        lines.push(`## ${t("tasks.summaryStructured.overviewTitle")}`, "", data.overview.trim(), "")
        lines.push(`## ${t("tasks.summaryStructured.keypointsTitle")}`, "")
        for (const kp of data.keypoints) {
            const title = (kp.title || "").trim()
            const detail = (kp.detail || "").trim()
            const evidence = (kp.evidence || "").trim()
            if (!title && !detail) continue
            const start = typeof kp.startSeconds === "number" && Number.isFinite(kp.startSeconds) ? kp.startSeconds : null
            const timeTag = start !== null ? `**[${formatSeconds(start)}]** ` : ""
            lines.push(`- ${timeTag}**${title || detail.slice(0, 48)}**${detail ? `: ${detail}` : ""}`)
            if (evidence) lines.push(`  - ${t("tasks.summaryStructured.evidenceLabel")}: ${evidence}`)
        }
        return lines.join("\n").trim() + "\n"
    }

    const handleCopy = async () => {
        if (!parsed) return
        const textToCopy = toMarkdown(parsed)
        await navigator.clipboard.writeText(textToCopy)
    }

    const anySummary = summaryOutputs[0] || summarySource || outputs.find(o => o.kind === 'summary')

    if (!anySummary) {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[220px] md:min-h-[300px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground p-6 md:p-10">
                    <div className="mb-4 flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                            <FileText className="h-6 w-6 opacity-50" />
                        </div>
                    </div>
                    {summaryPlaceholder || t("tasks.contentPending")}
                </CardContent>
            </Card>
        )
    }

    if (anySummary.status === "error") {
        return (
            <Card className="bg-red-950/20 border-red-500/30">
                <CardContent className="p-6 flex flex-col items-center gap-4 text-red-300">
                    <p>{t("tasks.failedToGenerate", { error: anySummary.error_message || "" })}</p>
                    <p className="text-sm text-red-200/80">{t("tasks.processingHint1")}</p>
                </CardContent>
            </Card>
        )
    }

    if (anySummary.status === "processing" || anySummary.status === "pending") {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[220px] md:min-h-[300px] flex items-center justify-center">
                <CardContent className="p-6 md:p-10 text-center space-y-4">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                    <div>
                        <p className="font-medium text-foreground">{t("tasks.generatingContent")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("tasks.percentComplete", { percent: anySummary.progress })}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!parsed) {
        return <OutputCard output={anySummary} placeholder={summaryPlaceholder} />
    }

    const hasAnyAnchors = parsed.keypoints.some((kp) => typeof kp.startSeconds === "number" && Number.isFinite(kp.startSeconds))

    return (
        <Card ref={containerRef} className="bg-black/20 border-white/5 group">
            <CardContent className="p-3 sm:p-4 md:p-8 space-y-4 md:space-y-6">
                <div className="relative flex items-center justify-center min-h-[32px] mb-2 md:mb-4">
                    <div className="flex flex-1 items-center justify-center gap-3">
                        {classification && (
                            <Badge
                                variant="outline"
                                className="px-3 py-1 text-xs font-normal border bg-blue-500/10 text-blue-400 border-blue-500/20"
                                data-export-hide="true"
                            >
                                {CLS_LABELS[classification.content_form] || classification.content_form}
                            </Badge>
                        )}

                        {showLanguageSelector && (
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="gap-2 h-8 px-3 bg-black/30 border-white/10 hover:bg-black/50 hover:border-white/20"
                                >
                                    <Languages className="h-4 w-4" />
                                    <span>{getLocaleLabel(selectedLocale)}</span>
                                    <ChevronDown className={`h-3 w-3 transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                                </Button>
                                {isLangOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsLangOpen(false)} />
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[140px] py-1 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl">
                                            {availableLocalesList.map((lang) => (
                                                <button
                                                    key={lang}
                                                    onClick={() => {
                                                        setSelectedLocale(lang)
                                                        setIsLangOpen(false)
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedLocale === lang ? 'text-primary' : 'text-white/80'
                                                        }`}
                                                >
                                                    {selectedLocale === lang && <Check className="h-3 w-3" />}
                                                    <span className={selectedLocale === lang ? '' : 'ml-5'}>
                                                        {getLocaleLabel(lang)}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="absolute right-0 top-1/2 -translate-y-1/2" data-export-hide="true">
                        <SummaryShareButton
                            containerRef={containerRef}
                            title={taskTitle || ""}
                            coverUrl={coverUrl}
                            onCopyMarkdown={handleCopy}
                            t={t}
                        />
                    </div>
                </div>

                <div className="grid gap-8">
                    <div className="bg-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/5 relative overflow-hidden transition-colors hover:bg-white/[0.07]">
                        <div className="relative">
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles className="w-5 h-5 text-primary" />
                                <h3 className="text-xl font-bold tracking-tight text-white">
                                    {t("tasks.summaryStructured.overviewTitle")}
                                </h3>
                            </div>

                            <div className="text-base sm:text-lg leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                {parsed.overview}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center gap-3 mb-4 md:mb-6 px-1 sm:px-2">
                            <Zap className="w-5 h-5 text-primary" />
                            <h3 className="text-xl font-bold tracking-tight text-white">
                                {keypointsTitle}
                            </h3>
                        </div>

                        {!hasAnyAnchors && (
                            <div className="mb-4 px-2 text-sm text-yellow-400 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                                Note: Timeline anchors are currently unavailable for this summary.
                            </div>
                        )}

                        <div className="grid gap-3">
                            {parsed.keypoints.map((kp, idx) => (
                                <SummaryKeypointItem
                                    key={`${idx}-${kp.title}`}
                                    kp={kp}
                                    canSeek={canSeek}
                                    onSeek={onSeek}
                                    t={t}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card >
    )
}

function SummaryKeypointItem({
    kp,
    canSeek,
    onSeek,
    t,
}: {
    kp: StructuredSummaryV1["keypoints"][number]
    canSeek: boolean
    onSeek: (seconds: number) => void
    t: (key: string, vars?: Record<string, string | number>) => string
}) {
    const startSeconds =
        typeof kp.startSeconds === "number" && Number.isFinite(kp.startSeconds) ? kp.startSeconds : null
    const endSeconds =
        typeof kp.endSeconds === "number" && Number.isFinite(kp.endSeconds) ? kp.endSeconds : null

    const isClickable = startSeconds !== null && canSeek

    const containerClasses = [
        "group relative w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden",
        "bg-[#1A1A1A] hover:bg-[#202020]",
        "border-white/5 hover:border-primary/30",
        isClickable ? "cursor-pointer" : "cursor-default"
    ].join(" ")

    const innerContent = (
        <div className="p-4 md:p-5 relative z-10">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover:bg-primary transition-all duration-300" />

            <div className="flex flex-col gap-2 ml-2">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 md:gap-4">
                    <h4 className="text-base font-semibold text-foreground/95 leading-snug group-hover:text-primary transition-colors">
                        {kp.title}
                    </h4>

                    {startSeconds !== null && (
                        <div className="shrink-0">
                            <Badge
                                variant="outline"
                                className={`
                                    font-mono text-[10px] py-0.5 px-1.5 gap-1 transition-colors h-5
                                    ${isClickable
                                        ? "bg-primary/10 text-primary border-primary/20 group-hover:bg-primary group-hover:text-black"
                                        : "bg-white/5 text-muted-foreground border-white/10"}
                                `}
                            >
                                <PlayCircle className="w-3 h-3" />
                                <span>{formatSeconds(startSeconds)}</span>
                                {endSeconds !== null && endSeconds > startSeconds + 0.5 ? (
                                    <span className="opacity-60">– {formatSeconds(endSeconds)}</span>
                                ) : null}
                            </Badge>
                        </div>
                    )}
                </div>

                {kp.detail ? (
                    <p className="text-sm text-muted-foreground/90 leading-relaxed text-pretty">
                        {kp.detail}
                    </p>
                ) : null}

                {kp.evidence ? (
                    <div className="mt-1 flex items-start gap-2 text-[11px] text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                        <Quote className="w-3 h-3 shrink-0 opacity-50 relative top-0.5" />
                        <span className="italic leading-relaxed">{kp.evidence}</span>
                    </div>
                ) : null}
            </div>
        </div>
    )

    if (startSeconds !== null && canSeek) {
        return (
            <button
                type="button"
                onClick={() => onSeek(startSeconds)}
                className={containerClasses}
            >
                {innerContent}
            </button>
        )
    }

    return <div className={containerClasses}>{innerContent}</div>
}

function ComprehensionBriefSection({ content }: { content: string }) {
    const { t } = useI18n()
    const data = useMemo<ComprehensionBriefResponse | null>(() => {
        try {
            return JSON.parse(content)
        } catch (e) {
            console.error("Failed to parse Comprehension Brief", e)
            return null
        }
    }, [content])

    if (!data) return null

    return (
        <div className="space-y-12 py-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            {/* 1. Bento Grid Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-fr">
                {/* Core Intent - Driver */}
                <div className="md:col-span-1 p-6 rounded-3xl bg-gradient-to-br from-emerald-950/80 to-black border border-emerald-500/20 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Zap className="w-32 h-32 text-emerald-500" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            {t("tasks.comprehensionBrief.coreIntent")}
                        </h3>
                        <p className="text-xl md:text-2xl font-semibold text-white leading-relaxed whitespace-pre-wrap">
                            {data.core_intent}
                        </p>
                    </div>
                </div>

                {/* Core Position - Stance */}
                <div className="md:col-span-1 p-6 rounded-3xl bg-white/[0.03] border border-white/10 relative overflow-hidden group hover:bg-white/[0.05] transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ArrowRight className="w-32 h-32 text-amber-500" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                        <h3 className="text-xs font-bold text-amber-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {t("tasks.comprehensionBrief.corePosition")}
                        </h3>
                        <p className="text-lg md:text-xl font-medium text-white/90 leading-relaxed whitespace-pre-wrap">
                            {data.core_position}
                        </p>
                    </div>
                </div>
            </div>

            {/* 2. Smart Filters (Audience & Ignore) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Who it's for */}
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                        <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <UserCheck className="w-4 h-4" />
                            {t("tasks.comprehensionBrief.whoBenefits")}
                        </h3>
                        <ul className="space-y-3">
                            {data.target_audience.who_benefits.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-emerald-100">
                                    <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {/* Who it's NOT for */}
                    <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/10">
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <UserMinus className="w-4 h-4" />
                            {t("tasks.comprehensionBrief.whoWont")}
                        </h3>
                        <ul className="space-y-3">
                            {data.target_audience.who_wont.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-sm text-red-200">
                                    <X className="w-4 h-4 shrink-0 text-red-400/50 mt-0.5" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Ignore List */}
                {data.what_to_ignore && data.what_to_ignore.length > 0 && (
                    <div className="lg:col-span-1 p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col justify-center">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500/80" />
                            {t("tasks.comprehensionBrief.whatToIgnore")}
                        </h3>
                        <ul className="space-y-2">
                            {data.what_to_ignore.map((item, idx) => (
                                <li key={idx} className="text-xs text-muted-foreground/80 leading-relaxed pl-2 border-l border-white/10">
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* 3. Insight Flow */}
            <div className="relative pl-4 md:pl-0">
                <div className="absolute left-0 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/50 via-emerald-500/10 to-transparent hidden md:block" />

                <div className="space-y-8 md:space-y-12">
                    {data.key_insights.map((insight, idx) => (
                        <div key={idx} className="relative md:pl-20 group">
                            {/* Marker */}
                            <div className="absolute left-0 md:left-6 top-1.5 -translate-x-1/2 w-4 h-4 rounded-full bg-[#0A0A0A] border-2 border-emerald-500/50 group-hover:border-emerald-500 group-hover:shadow-[0_0_10px_rgb(16,185,129)] transition-all hidden md:block" />

                            <div className="space-y-3">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-emerald-500/70 font-mono text-sm md:hidden">#{idx + 1}</span>
                                    <h4 className="text-xl md:text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors leading-snug">
                                        {insight.title}
                                    </h4>
                                </div>

                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 text-xs text-muted-foreground">
                                    <Sparkles className="w-3 h-3" />
                                    <span className="whitespace-pre-wrap max-w-prose">{insight.why_it_matters}</span>
                                </div>

                                <p className="text-base md:text-lg text-muted-foreground leading-relaxed whitespace-pre-wrap border-l-2 border-white/5 pl-4 md:border-none md:pl-0">
                                    {insight.new_perspective}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. Crown Jewel (Reusable Takeaway) */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 rounded-3xl opacity-20 blur transition duration-1000 group-hover:opacity-40 group-hover:duration-200"></div>
                <div className="relative p-8 md:p-10 rounded-[22px] bg-[#0A0A0A] border border-white/10 overflow-hidden">
                    {/* Deco Background */}
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Quote className="w-40 h-40 text-white transform rotate-12" />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                                {t("tasks.comprehensionBrief.reusableTakeaway")}
                            </h3>
                            <div className="flex gap-1.5">
                                {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500/30" />)}
                            </div>
                        </div>

                        <div className="text-xl md:text-3xl font-bold leading-tight text-white/90 whitespace-pre-wrap">
                            <Markdown components={{
                                p: ({ node, ...props }) => <p {...props} className="mb-4 last:mb-0" />,
                                strong: ({ node, ...props }) => <span className="text-emerald-400" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-2 my-4" {...props} />,
                                li: ({ node, ...props }) => <li className="text-lg text-white/80" {...props} />
                            }}>
                                {data.reusable_takeaway}
                            </Markdown>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function FullScriptSection({
    script,
    scriptRawContent,
    scriptPlaceholder,
    detectedLanguageLabel,
    canSeek,
    onSeek,
    t,
}: {
    script?: Output
    scriptRawContent?: string
    scriptPlaceholder: string
    detectedLanguageLabel: string
    canSeek: boolean
    onSeek: (seconds: number) => void
    t: (key: string, vars?: Record<string, string | number>) => string
}) {
    const [isCopied, setIsCopied] = useState(false)

    const handleCopy = async () => {
        if (!scriptRawContent) return

        const blocks = buildTranscriptBlocks(scriptRawContent)
        const textToCopy = blocks.map(b => b.text).join("\n\n")

        try {
            await navigator.clipboard.writeText(textToCopy)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy:", err)
        }
    }

    return (
        <Card className="bg-black/20 border-white/5 relative group">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 bg-black/50 hover:bg-black/70 text-muted-foreground hover:text-white border border-white/10"
                    onClick={handleCopy}
                >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {isCopied ? t("tasks.copied") : t("tasks.copyToClipboard")}
                </Button>
            </div>

            <CardHeader className="pb-2">
                <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">
                        {t("tasks.originalScriptLanguage", { language: detectedLanguageLabel })}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <TranscriptTimeline
                    scriptRawContent={scriptRawContent}
                    canSeek={canSeek}
                    onSeek={onSeek}
                    emptyFallback={<OutputCard output={script} placeholder={scriptPlaceholder} isScript={true} />}
                />
            </CardContent>
        </Card>
    )
}

function OutputCard({ output, placeholder, isScript = false }: { output?: Output, placeholder?: string, isScript?: boolean }) {
    const { t } = useI18n()
    const [isCopied, setIsCopied] = useState(false)

    const cleanedContent = isScript ? stripRedundantTranscriptHeaders(output?.content) : output?.content

    const handleCopy = async () => {
        if (!cleanedContent) return
        try {
            await navigator.clipboard.writeText(cleanedContent)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    if (!output) {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[220px] md:min-h-[300px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground p-6 md:p-10">
                    <div className="mb-4 flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                            {isScript ? <Subtitles className="h-6 w-6 opacity-50" /> : <FileText className="h-6 w-6 opacity-50" />}
                        </div>
                    </div>
                    {placeholder || t("tasks.contentPending")}
                </CardContent>
            </Card>
        )
    }

    if (output.status === 'error') {
        return (
            <Card className="bg-red-950/20 border-red-500/30">
                <CardContent className="p-6 flex flex-col items-center gap-4 text-red-300">
                    <p>{t("tasks.failedToGenerate", { error: output.error_message || "" })}</p>
                    <p className="text-sm text-red-200/80">{t("tasks.processingHint1")}</p>
                </CardContent>
            </Card>
        )
    }

    if (output.status === 'processing' || output.status === 'pending') {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[220px] md:min-h-[300px] flex items-center justify-center">
                <CardContent className="p-6 md:p-10 text-center space-y-4">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                    <div>
                        <p className="font-medium text-foreground">{t("tasks.generatingContent")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("tasks.percentComplete", { percent: output.progress })}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-black/20 border-white/5 relative group">
            <div className="absolute top-3 right-3 md:top-4 md:right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 bg-black/50 hover:bg-black/70 text-muted-foreground hover:text-white border border-white/10"
                    onClick={handleCopy}
                >
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {isCopied ? t("tasks.copied") : t("tasks.copyToClipboard")}
                </Button>
            </div>
            <CardContent className="p-4 pt-12 md:p-8 md:pt-10">
                <div className="prose prose-invert prose-base md:prose-lg max-w-none prose-headings:text-primary prose-a:text-primary prose-strong:text-white prose-strong:font-bold">
                    <Markdown
                        components={{
                            strong: ({ ...props }) => <strong className="text-primary font-mono bg-primary/10 px-1 rounded" {...props} />
                        }}
                    >
                        {cleanedContent}
                    </Markdown>
                </div>
            </CardContent>
        </Card>
    )
}

function stripRedundantTranscriptHeaders(content?: string) {
    if (!content) return content

    const lines = content.split("\n")
    const filtered = lines.filter((line) => {
        const trimmed = line.trim()
        if (!trimmed) return true
        if (/^\*\*Detected Language:\*\*/i.test(trimmed)) return false
        if (/^##\s*Transcription Content\b/i.test(trimmed)) return false
        if (/^#\s*Video Transcription\b/i.test(trimmed)) return false
        return true
    })

    return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function TaskProgress({
    task,
    isSubscribed,
    permission,
    onNotify,
    t,
}: {
    task: Task
    isSubscribed: boolean
    permission: string
    onNotify: () => void
    t: (key: string, vars?: Record<string, string | number>) => string
}) {
    const [stepIndex, setStepIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((i) => i + 1)
        }, 4000)
        return () => clearInterval(interval)
    }, [])

    const getStatusMessage = () => {
        const p = task.progress
        let step = 1

        if (p < 20) {
            step = (stepIndex % 2) + 1
        } else if (p < 80) {
            step = (stepIndex % 2) + 3
        } else {
            step = 5
        }

        return t(`tasks.statusSteps.step${step}`)
    }

    return (
        <div className="space-y-4 mb-8 p-6 bg-primary/5 rounded-xl border border-primary/10 transition-all duration-500">
            <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                <span className="font-medium text-primary flex-1 transition-all duration-300">
                    {getStatusMessage()}
                </span>
                <span className="ml-auto font-mono text-muted-foreground">{task.progress}%</span>
            </div>

            <div className="relative">
                <Progress value={task.progress} className="h-2 transition-all duration-1000" />
            </div>

            <p className="text-xs text-muted-foreground text-center animate-pulse">
                {t("tasks.processingHint1")}
                <br />
                {t("tasks.processingHint2")}
            </p>

            <div className="flex justify-center pt-2">
                {isSubscribed ? (
                    <Button variant="outline" size="sm" className="gap-2 text-green-600 border-green-600/20 bg-green-500/10 pointer-events-none">
                        <Bell className="h-4 w-4" />
                        {t("tasks.notificationEnabled")}
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={onNotify}
                        disabled={permission === "denied"}
                    >
                        {permission === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        {t("tasks.enableNotifications")}
                    </Button>
                )}
            </div>
        </div>
    )
}

function MindMapSection({
    outputs,
    t,
    locale,
}: {
    outputs: Output[]
    t: (key: string, vars?: Record<string, string | number>) => string
    locale: string
}) {
    const summaryOutputs = outputs.filter(o => o.kind === 'summary' && o.status === 'completed')
    const summarySource = outputs.find(o => o.kind === 'summary_source' && o.status === 'completed')

    const parseSummary = (output?: Output) => {
        if (!output?.content) return null
        try {
            const obj = JSON.parse(output.content) as StructuredSummaryV1
            if (!obj || typeof obj !== "object") return null
            if (typeof obj.overview !== "string") return null
            if (!Array.isArray(obj.keypoints)) return null
            return obj
        } catch {
            return null
        }
    }

    const availableLocales = useMemo(() => {
        const map = new Map<string, { output: Output; parsed: StructuredSummaryV1; isSource?: boolean }>()

        if (summarySource) {
            const parsed = parseSummary(summarySource)
            if (parsed) {
                const lang = (parsed.language || 'source').toLowerCase()
                map.set(lang, { output: summarySource, parsed, isSource: true })
            }
        }

        for (const output of summaryOutputs) {
            const parsed = parseSummary(output)
            if (parsed) {
                const lang = (parsed.language || output.locale || 'unknown').toLowerCase()
                if (!map.has(lang) || map.get(lang)?.isSource) {
                    map.set(lang, { output, parsed })
                }
            }
        }

        return map
    }, [summaryOutputs, summarySource])

    const initialLocale = useMemo(() => {
        if (availableLocales.has(locale)) return locale
        if (availableLocales.has('en')) return 'en'
        const keys = Array.from(availableLocales.keys())
        return keys[0] || 'source'
    }, [availableLocales, locale])

    const [selectedLocale, setSelectedLocale] = useState<string>(initialLocale)
    const [isOpen, setIsOpen] = useState(false)

    const current = availableLocales.get(selectedLocale) || availableLocales.get(initialLocale)
    const parsed = current?.parsed || null

    const mindMapData: MindMapNode | null = parsed ? {
        content: parsed.overview,
        children: parsed.keypoints
            .filter(kp => kp.title)
            .map((kp, idx) => ({
                content: `${idx + 1}. ${kp.title}`,
                children: kp.evidence ? [{ content: kp.evidence, children: [] }] : []
            }))
    } : null

    const anySummary = summaryOutputs[0] || summarySource || outputs.find(o => o.kind === 'summary')

    if (!anySummary) {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[500px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground p-6 md:p-10">
                    <div className="mb-4 flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                            <Network className="h-6 w-6 opacity-50" />
                        </div>
                    </div>
                    {t("tasks.contentPending")}
                </CardContent>
            </Card>
        )
    }

    if (anySummary.status === "error") {
        return (
            <Card className="bg-red-950/20 border-red-500/30">
                <CardContent className="p-6 flex flex-col items-center gap-4 text-red-300">
                    <p>{t("tasks.failedToGenerate", { error: anySummary.error_message || "" })}</p>
                </CardContent>
            </Card>
        )
    }

    if (anySummary.status === "processing" || anySummary.status === "pending") {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[500px] flex items-center justify-center">
                <CardContent className="p-6 md:p-10 text-center space-y-4">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                    <div>
                        <p className="font-medium text-foreground">{t("tasks.generatingContent")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("tasks.percentComplete", { percent: anySummary.progress })}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!mindMapData) {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[500px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground p-6 md:p-10">
                    <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>{t("tasks.summaryPlaceholder")}</p>
                </CardContent>
            </Card>
        )
    }

    const getLocaleLabel = (lang: string) => {
        if (lang in LOCALE_LABEL) {
            return LOCALE_LABEL[lang as Locale]
        }
        return lang.toUpperCase()
    }

    const availableLocalesList = Array.from(availableLocales.keys())
    const showLanguageSelector = availableLocalesList.length > 1

    return (
        <div className="space-y-4">
            {showLanguageSelector && (
                <div className="flex justify-center">
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsOpen(!isOpen)}
                            className="gap-2 h-8 px-3 bg-black/30 border-white/10 hover:bg-black/50 hover:border-white/20"
                        >
                            <Languages className="h-4 w-4" />
                            <span>{getLocaleLabel(selectedLocale)}</span>
                            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {isOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[140px] py-1 bg-[#1A1A1A] border border-white/10 rounded-lg shadow-xl">
                                    {availableLocalesList.map((loc) => (
                                        <button
                                            key={loc}
                                            onClick={() => {
                                                setSelectedLocale(loc)
                                                setIsOpen(false)
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors flex items-center gap-2 ${selectedLocale === loc ? 'text-primary' : 'text-white/80'
                                                }`}
                                        >
                                            {selectedLocale === loc && <Check className="h-3 w-3" />}
                                            <span className={selectedLocale === loc ? '' : 'ml-5'}>
                                                {getLocaleLabel(loc)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <MindMap key={selectedLocale} data={mindMapData} />
        </div>
    )
}
