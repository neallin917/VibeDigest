"use client"

import { use, useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { FileText, Subtitles, Copy, Check, Sparkles, PlayCircle, Quote, Zap } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { createClient } from "@/lib/supabase"
import ReactMarkdown from "react-markdown"
import { useI18n } from "@/components/i18n/I18nProvider"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { VideoEmbed, supportsVideoEmbed } from "@/components/tasks/VideoEmbed"
import { AudioEmbed } from "@/components/tasks/AudioEmbed"
import { Heading } from "@/components/ui/typography"
import { TranscriptTimeline, buildTranscriptBlocks } from "@/components/tasks/TranscriptTimeline"
import { formatSeconds } from "@/components/tasks/transcript"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { SummaryExportButton } from "@/components/tasks/SummaryExportButton"
import { Bell, BellOff } from "lucide-react"

type Task = {
    id: string
    video_url: string
    video_title: string
    thumbnail_url?: string
    status: string
    progress: number
    created_at: string
}

type Output = {
    id: string
    kind: string // script, summary, translation, audio
    locale?: string
    status: string
    progress: number
    content: string
    error_message?: string
}

type StructuredSummaryV1 = {
    version: number
    language: string
    overview: string
    keypoints: Array<{
        title: string
        detail: string
        evidence?: string
        startSeconds?: number
        endSeconds?: number
    }>
}

type MediaController = {
    seek: (seconds: number) => void
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [task, setTask] = useState<Task | null>(null)
    const [outputs, setOutputs] = useState<Output[]>([])
    // Default to summary (primary UX)
    const [activeTab, setActiveTab] = useState("summary")
    const [mediaController, setMediaController] = useState<MediaController | null>(null)
    const supabase = createClient()

    const { t, locale } = useI18n()
    const { permission, subscribeToTask, isSubscribed } = useTaskNotification()

    // ... (existing code)

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
    // Do not place hooks after conditional returns (e.g. when task is null on first render).
    const handleMediaReady = useCallback((ctrl: MediaController) => {
        setMediaController(ctrl)
    }, [])

    const handleSeek = useCallback((seconds: number) => {
        if (!mediaController) return
        try {
            mediaController.seek(seconds)
            // Scroll to video player with a bit of offset if possible, 
            // but 'center' block alignment usually works well to bring it into focus.
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchTask()
        void fetchOutputs()

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
    }, [id, supabase, fetchOutputs, fetchTask])

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
        // createTranslator returns key when missing; treat that as "unknown"
        if (maybe === key) return detectedLanguageCode
        return maybe
    })()

    // audio.content can be either:
    // - plain URL string (legacy)
    // - JSON: { audioUrl: string, coverUrl?: string }
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
                                {hasVideo ? <VideoEmbed videoUrl={task.video_url} title={task.video_title} onReady={handleMediaReady} /> : null}
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
                                <TabsList className="grid w-full grid-cols-2 h-12">
                                    <TabsTrigger value="summary" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                        <FileText className="hidden sm:block h-4 w-4" /> {t("tasks.tabSummary")}
                                    </TabsTrigger>
                                    <TabsTrigger value="script" className="gap-2 px-2 sm:px-3 text-xs sm:text-sm">
                                        <Subtitles className="hidden sm:block h-4 w-4" /> {t("tasks.tabScript")}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="summary" className="mt-4 md:mt-6 space-y-4">
                                    <SummarySection
                                        taskTitle={task.video_title}
                                        summary={summary}
                                        summarySource={summarySource}
                                        summaryPlaceholder={t("tasks.summaryPlaceholder")}
                                        canSeek={Boolean(mediaController)}
                                        onSeek={handleSeek}
                                        t={t}
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

function SummarySection({
    taskTitle,
    summary,
    summarySource,
    summaryPlaceholder,
    canSeek,
    onSeek,
    t,
}: {
    taskTitle?: string
    summary?: Output
    summarySource?: Output
    summaryPlaceholder: string
    canSeek: boolean
    onSeek: (seconds: number) => void
    t: (key: string, vars?: Record<string, string | number>) => string
}) {
    const [isCopied, setIsCopied] = useState(false)
    const [viewMode, setViewMode] = useState<"translated" | "original">("translated")
    const containerRef = useRef<HTMLDivElement>(null)

    const translatedParsed = (() => {
        if (!summary?.content) return null
        try {
            const obj = JSON.parse(summary.content) as StructuredSummaryV1
            if (!obj || typeof obj !== "object") return null
            if (typeof obj.overview !== "string") return null
            if (!Array.isArray(obj.keypoints)) return null
            return obj
        } catch {
            return null
        }
    })()

    const sourceParsed = (() => {
        if (!summarySource?.content) return null
        try {
            const obj = JSON.parse(summarySource.content) as StructuredSummaryV1
            if (!obj || typeof obj !== "object") return null
            if (typeof obj.overview !== "string") return null
            if (!Array.isArray(obj.keypoints)) return null
            return obj
        } catch {
            return null
        }
    })()

    const hasSource = Boolean(summarySource && summarySource.status === "completed" && sourceParsed)

    // Check if languages are effectively the same
    const isSameLanguage = (() => {
        if (!translatedParsed || !sourceParsed) return false
        // Heuristic: compare language strings (e.g. "en" vs "en")
        const lang1 = (translatedParsed.language || "").toLowerCase()
        const lang2 = (sourceParsed.language || "").toLowerCase()
        // Or if the content is identical by simple check (optional, but language code is safer first step)
        return lang1 === lang2
    })()

    // If languages are the same, force "translated" (which is actually the localized version intended for display)
    // and effectively disable the toggle (hide it in UI).
    const effectiveMode: "translated" | "original" = (hasSource && !isSameLanguage) ? viewMode : "translated"
    const parsed = effectiveMode === "original" ? sourceParsed : translatedParsed

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
        if (!summary?.content && !summarySource?.content) return
        try {
            const rawFallback = effectiveMode === "original" ? (summarySource?.content || "") : (summary?.content || "")
            const textToCopy = parsed ? toMarkdown(parsed) : rawFallback
            await navigator.clipboard.writeText(textToCopy)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error("Failed to copy:", err)
        }
    }

    if (!summary) {
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

    if (summary.status === "error") {
        return (
            <Card className="bg-red-950/20 border-red-500/30">
                <CardContent className="p-6 flex flex-col items-center gap-4 text-red-300">
                    <p>{t("tasks.failedToGenerate", { error: summary.error_message || "" })}</p>
                    <p className="text-sm text-red-200/80">{t("tasks.processingHint1")}</p>
                </CardContent>
            </Card>
        )
    }

    if (summary.status === "processing" || summary.status === "pending") {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[220px] md:min-h-[300px] flex items-center justify-center">
                <CardContent className="p-6 md:p-10 text-center space-y-4">
                    <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                    <div>
                        <p className="font-medium text-foreground">{t("tasks.generatingContent")}</p>
                        <p className="text-sm text-muted-foreground mt-1">{t("tasks.percentComplete", { percent: summary.progress })}</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (!parsed) {
        // Backward compatibility: old markdown summaries
        return <OutputCard output={summary} placeholder={summaryPlaceholder} />
    }

    const hasAnyAnchors = parsed.keypoints.some((kp) => typeof kp.startSeconds === "number" && Number.isFinite(kp.startSeconds))

    return (
        <Card ref={containerRef} className="bg-black/20 border-white/5 group">
            <CardContent className="p-3 sm:p-4 md:p-8 space-y-4 md:space-y-6">
                <div className="relative flex items-center justify-center min-h-[32px] mb-2 md:mb-4">
                    {hasSource && !isSameLanguage ? (
                        <div className="flex items-center bg-black/20 p-1 rounded-lg border border-white/5 transition-colors hover:bg-black/30">
                            <Button
                                type="button"
                                size="sm"
                                variant={effectiveMode === "original" ? "secondary" : "ghost"}
                                className="h-7 text-xs px-3 hover:bg-white/10"
                                onClick={() => setViewMode("original")}
                            >
                                {t("tasks.summaryStructured.showOriginal")}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={effectiveMode === "translated" ? "secondary" : "ghost"}
                                className="h-7 text-xs px-3 hover:bg-white/10"
                                onClick={() => setViewMode("translated")}
                            >
                                {t("tasks.summaryStructured.showTranslated")}
                            </Button>
                        </div>
                    ) : null}

                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2" data-export-hide="true">
                        <SummaryExportButton
                            containerRef={containerRef}
                            title={taskTitle || ""}
                            t={t}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 bg-black/50 hover:bg-black/70 text-muted-foreground hover:text-white border border-white/10 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={handleCopy}
                            aria-label={isCopied ? t("tasks.copied") : t("tasks.copyToClipboard")}
                        >
                            {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            <span className="hidden sm:inline">{isCopied ? t("tasks.copied") : t("tasks.copyToClipboard")}</span>
                        </Button>
                    </div>
                </div>
                <div className="grid gap-8">
                    {/* Overview Section */}
                    <div className="bg-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/5 relative overflow-hidden transition-colors hover:bg-white/[0.07]">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Sparkles className="w-24 h-24" />
                        </div>
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

                    {/* Keypoints Section */}
                    <div>
                        <div className="flex items-center gap-3 mb-4 md:mb-6 px-1 sm:px-2">
                            <Zap className="w-5 h-5 text-primary" />
                            <h3 className="text-xl font-bold tracking-tight text-white">
                                {t("tasks.summaryStructured.keypointsTitle")}
                            </h3>
                        </div>

                        {!hasAnyAnchors && (
                            <div className="mb-4 px-2 text-sm text-yellow-500/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
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
        </Card>
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

    // A more distinct card style
    const containerClasses = [
        "group relative w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden",
        "bg-[#1A1A1A] hover:bg-[#202020]", // Slightly lighter dark background on hover
        "border-white/5 hover:border-primary/30", // Gentle border highlight
        isClickable ? "cursor-pointer" : "cursor-default"
    ].join(" ")

    const innerContent = (
        <div className="p-4 md:p-5 relative z-10">
            {/* Left accent line that glows on hover */}
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
                    <div className="mt-1 flex items-start gap-2 text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
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

        // Use the same block building logic as the timeline to get clean, segmented text
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
                    <ReactMarkdown
                        components={{
                            // Customize timestamp rendering if needed, 
                            // but basic strong tag from backend (**[MM:SS]**) will be rendered as <strong>
                            // We can style strong tags to be distinct.
                            strong: ({ ...props }) => <strong className="text-primary font-mono bg-primary/10 px-1 rounded" {...props} />
                        }}
                    >
                        {cleanedContent}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
    )
}

function stripRedundantTranscriptHeaders(content?: string) {
    if (!content) return content

    // Backend previously included these headings inside the script markdown.
    // The task detail UI already renders "original script language" above the card,
    // so this becomes redundant/noisy. We keep this cleanup for backward compatibility
    // with existing saved outputs.
    const lines = content.split("\n")
    const filtered = lines.filter((line) => {
        const trimmed = line.trim()
        if (!trimmed) return true
        if (/^\*\*Detected Language:\*\*/i.test(trimmed)) return false
        if (/^##\s*Transcription Content\b/i.test(trimmed)) return false
        if (/^#\s*Video Transcription\b/i.test(trimmed)) return false
        return true
    })

    // Collapse excessive blank lines introduced by removing headers
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
            // Phase 1: Analyzing & Extracting
            step = (stepIndex % 2) + 1
        } else if (p < 80) {
            // Phase 2: Transcribing & Speakers
            step = (stepIndex % 2) + 3
        } else {
            // Phase 3: Summarizing
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
