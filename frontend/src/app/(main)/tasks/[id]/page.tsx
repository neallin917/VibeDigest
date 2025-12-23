"use client"

import { use, useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Languages, PlayCircle, Subtitles, Copy, Check } from "lucide-react"
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

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [task, setTask] = useState<Task | null>(null)
    const [outputs, setOutputs] = useState<Output[]>([])
    // Changed default to 'script' to show transcription first as per user request
    const [activeTab, setActiveTab] = useState("script")
    const supabase = createClient()
    const { t } = useI18n()

    async function fetchTask() {
        const { data } = await supabase.from('tasks').select('*').eq('id', id).single()
        if (data) setTask(data)
    }

    async function fetchOutputs() {
        const { data } = await supabase.from('task_outputs').select('*').eq('task_id', id)
        if (data) setOutputs(data)
    }

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
    }, [id, supabase])

    // Retry is intentionally not exposed in the UI.

    if (!task) return <div className="p-10 text-center">{t("tasks.loadingTask")}</div>

    const script = outputs.find(o => o.kind === 'script')
    const summary = outputs.find(o => o.kind === 'summary')
    const translations = outputs.filter(o => o.kind === 'translation')
    const audio = outputs.find(o => o.kind === 'audio')
    const hasVideo = supportsVideoEmbed(task.video_url)

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
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/history">
                    <Button variant="ghost" size="sm" className="gap-2 pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="h-4 w-4" /> {t("history.backToHistory")}
                    </Button>
                </Link>
            </div>

            <Card className="glass">
                <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold">{task.video_title || task.video_url}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <PlayCircle className="h-4 w-4" />
                                <a
                                    href={task.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary hover:underline truncate max-w-md block"
                                >
                                    {task.video_url}
                                </a>
                            </div>
                        </div>
                        <Badge variant={task.status === "completed" ? "success" : task.status === "error" ? "destructive" : "processing"} className="text-sm px-3 py-1">
                            {task.status.toUpperCase()}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-6">
                        {hasVideo ? <VideoEmbed videoUrl={task.video_url} title={task.video_title} /> : null}
                        {!hasVideo && audio?.status === "completed" && audioUrl ? (
                            <AudioEmbed audioUrl={audioUrl} title={task.video_title} coverUrl={audioCoverUrl} />
                        ) : null}
                        {!hasVideo && (!audio || audio.status === "error") ? (
                            <div className="mt-3 text-sm text-muted-foreground">
                                {t("tasks.audioUnavailable")}{" "}
                                <a className="text-primary hover:underline" href={task.video_url} target="_blank" rel="noopener noreferrer">
                                    {t("tasks.openOriginalLink")}
                                </a>
                                。
                            </div>
                        ) : null}
                    </div>
                    {(task.status === "processing" || task.status === "pending") && (
                        <div className="space-y-4 mb-8 p-6 bg-primary/5 rounded-xl border border-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                                <span className="font-medium text-primary">{t("tasks.processingVideo")}</span>
                                <span className="ml-auto font-mono">{task.progress}%</span>
                            </div>
                            <Progress value={task.progress} className="h-2" />
                            <p className="text-xs text-muted-foreground text-center">
                                {t("tasks.processingHint1")}
                                <br />
                                {t("tasks.processingHint2")}
                            </p>
                        </div>
                    )}

                    {task.status === "error" && (
                        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
                            {t("tasks.taskError")}
                        </div>
                    )}

                    <Tabs defaultValue="script" value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-secondary/50 p-1">
                            <TabsTrigger value="script" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                <Subtitles className="h-4 w-4" /> {t("tasks.tabScript")}
                            </TabsTrigger>
                            <TabsTrigger value="summary" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                <FileText className="h-4 w-4" /> {t("tasks.tabSummary")}
                            </TabsTrigger>
                            <TabsTrigger value="translation" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-black font-medium">
                                <Languages className="h-4 w-4" /> {t("tasks.tabTranslation")}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="script" className="mt-6">
                            <OutputCard
                                output={script}
                                placeholder={t("tasks.scriptPlaceholder")}
                                isScript={true}
                            />
                        </TabsContent>

                        <TabsContent value="summary" className="mt-6 space-y-4">
                            <OutputCard output={summary} placeholder={t("tasks.summaryPlaceholder")} />
                        </TabsContent>

                        <TabsContent value="translation" className="mt-6 space-y-4">
                            {translations.length === 0 && <div className="text-center p-8 text-muted-foreground bg-black/20 rounded-xl">{t("tasks.noTranslations")}</div>}
                            {translations.map((tr) => (
                                <div key={tr.id}>
                                    <h3 className="mb-3 font-semibold text-primary/80 flex items-center gap-2">
                                        <Languages className="h-4 w-4" />
                                        {t("tasks.translationTitle", { locale: (tr.locale || "").toUpperCase() })}
                                    </h3>
                                    <OutputCard output={tr} />
                                </div>
                            ))}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}

function OutputCard({ output, placeholder, isScript = false }: { output?: Output, placeholder?: string, isScript?: boolean }) {
    const { t } = useI18n()
    const [isCopied, setIsCopied] = useState(false)

    const handleCopy = async () => {
        if (!output?.content) return
        try {
            await navigator.clipboard.writeText(output.content)
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy:', err)
        }
    }

    if (!output) {
        return (
            <Card className="bg-black/20 border-white/5 min-h-[300px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground p-10">
                    <div className="mb-4 flex justifying-center">
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
            <Card className="bg-black/20 border-white/5 min-h-[300px] flex items-center justify-center">
                <CardContent className="p-10 text-center space-y-4">
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
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
            <CardContent className="p-8 pt-10">
                <div className="prose prose-invert prose-lg max-w-none prose-headings:text-primary prose-a:text-primary prose-strong:text-white prose-strong:font-bold">
                    <ReactMarkdown
                        components={{
                            // Customize timestamp rendering if needed, 
                            // but basic strong tag from backend (**[MM:SS]**) will be rendered as <strong>
                            // We can style strong tags to be distinct.
                            strong: ({ ...props }) => <strong className="text-primary font-mono bg-primary/10 px-1 rounded" {...props} />
                        }}
                    >
                        {output.content}
                    </ReactMarkdown>
                </div>
            </CardContent>
        </Card>
    )
}
