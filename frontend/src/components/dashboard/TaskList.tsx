"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertCircle, PlayCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useI18n } from "@/components/i18n/I18nProvider"
import { LOCALE_DATE_TAG } from "@/lib/i18n"

type Task = {
    id: string
    video_url: string
    video_title?: string
    status: string
    progress: number
    created_at: string
    thumbnail_url?: string
}

const getPlatformFromUrl = (url: string) => {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.toLowerCase()
        if (hostname.includes('bilibili')) return 'Bilibili'
        if (hostname.includes('youtube') || hostname.includes('youtu.be')) return 'YouTube'
        if (hostname.includes('tiktok')) return 'TikTok'
        return 'Web'
    } catch {
        return 'Link'
    }
}

export function TaskList() {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()
    const { t, locale } = useI18n()

    async function fetchTasks(uid: string) {
        setLoading(true)
        const { data } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })

        if (data) setTasks(data)
        setLoading(false)
    }

    useEffect(() => {
        // 1. Get User
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUserId(session.user.id)
                fetchTasks(session.user.id)
            } else {
                setLoading(false)
            }
        }
        init()

        // 2. Auth Listener
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUserId(session.user.id)
                fetchTasks(session.user.id)
            } else {
                setTasks([])
                setUserId(null)
            }
        })

        return () => {
            authListener.subscription.unsubscribe()
        }
    }, [])

    // 3. Realtime Subscription
    useEffect(() => {
        if (!userId) return

        const channel = supabase.channel('realtime_tasks')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `user_id=eq.${userId}`
            }, (payload) => {
                console.log('Realtime update:', payload)
                fetchTasks(userId)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    if (loading) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                {t("tasks.loadingTasks")}
            </div>
        )
    }

    if (tasks.length === 0) {
        return (
            <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="text-center py-10 text-muted-foreground">
                    <p>{t("tasks.noTasks")}</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-0 bg-transparent shadow-none">
            <CardHeader className="px-0">
                <CardTitle>{t("tasks.recentTasks")}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        className="flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-card hover:bg-card/80 hover:border-white/10 transition-all cursor-pointer group"
                    >
                        {/* Thumbnail Placeholder */}
                        <div className="h-16 w-28 bg-black/40 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-white transition-colors overflow-hidden relative">
                            {task.thumbnail_url ? (
                                <img
                                    src={task.thumbnail_url}
                                    alt={task.video_title || t("tasks.videoThumbnailAlt")}
                                    className="h-full w-full object-cover"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <PlayCircle className="h-8 w-8 opacity-50 group-hover:opacity-100" />
                            )}
                        </div>

                        <div className="flex-1 overflow-hidden">
                            <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {task.video_title || task.video_url}
                            </h4>
                            {task.video_title && (
                                <p className="text-xs text-muted-foreground truncate hover:text-white/80 transition-colors">
                                    {task.video_url}
                                </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 font-normal border-white/10 bg-white/5">
                                    {getPlatformFromUrl(task.video_url)}
                                </Badge>
                                <span className="w-px h-3 bg-white/10 mx-1" />
                                <Clock className="h-3 w-3" />
                                {new Date(task.created_at).toLocaleString(LOCALE_DATE_TAG[locale])}
                            </div>
                        </div>

                        <div>
                            {task.status === "processing" && (
                                <Badge variant="processing" className="gap-1 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25">
                                    <span className="animate-pulse">●</span> {task.progress}%
                                </Badge>
                            )}
                            {task.status === "completed" && (
                                <Badge variant="success" className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                                    <CheckCircle2 className="h-3 w-3" /> {t("tasks.completed")}
                                </Badge>
                            )}
                            {task.status === "error" && (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" /> {t("tasks.error")}
                                </Badge>
                            )}
                            {task.status === "pending" && (
                                <Badge variant="secondary" className="gap-1">
                                    {t("tasks.waiting")}
                                </Badge>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}
