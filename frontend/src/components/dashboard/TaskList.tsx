"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertCircle, PlayCircle, Loader2, Trash2, Edit2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase"
import { useI18n } from "@/components/i18n/I18nProvider"
import { LOCALE_DATE_TAG } from "@/lib/i18n"
import { ApiClient } from "@/lib/api"
import { ConfirmationModal } from "@/components/ui/confirmation-modal"

const DEMO_TASK_ID = "1e60a06c-ef37-4f82-bffd-1a5135cb45c7"

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
        if (hostname.includes('apple.com')) return 'Apple Podcast'
        if (hostname.includes('xiaoyuzhoufm.com')) return 'Xiaoyuzhou'
        return 'Web'
    } catch {
        return 'Link'
    }
}

export function TaskList({ showHeader = true }: { showHeader?: boolean }) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean, taskId: string | null }>({
        isOpen: false,
        taskId: null
    })
    const [isDeleting, setIsDeleting] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()
    const { t, locale } = useI18n()

    async function fetchTasks(uid: string) {
        setLoading(true)
        const { data } = await supabase
            .from('tasks')
            .select('*')
            .or(`user_id.eq.${uid},id.eq.${DEMO_TASK_ID}`)
            .eq('is_deleted', false)
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

    async function getToken() {
        const { data: { session } } = await supabase.auth.getSession()
        return session?.access_token
    }

    const handleDeleteClick = (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation()
        setDeleteConfirmation({ isOpen: true, taskId })
    }

    const confirmDelete = async () => {
        const taskId = deleteConfirmation.taskId
        if (!taskId) return

        setIsDeleting(taskId)
        // Close modal immediately to show loading on the row trash icon? 
        // Or keep modal open with loading? 
        // The modal has isLoading prop. Let's use that.
        // Actually, current implementation of modal uses isLoading. 
        // But let's look at `isDeleting` state usage in the list.
        // We can just keep modal open until done.

        try {
            // Soft delete via Supabase directly
            const { error } = await supabase
                .from('tasks')
                .update({ is_deleted: true })
                .eq('id', taskId)

            if (error) throw error

            // await ApiClient.deleteTask(taskId, token)
            setTasks(tasks.filter(t => t.id !== taskId))
            setDeleteConfirmation({ isOpen: false, taskId: null })
        } catch (error) {
            console.error('Error deleting task:', error)
            alert(t("tasks.deleteError") + ": " + (error instanceof Error ? error.message : JSON.stringify(error)))
            // Ideally also close on error or show error in modal
            setDeleteConfirmation({ isOpen: false, taskId: null })
        } finally {
            setIsDeleting(null)
        }
    }

    const startEditing = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation()
        setEditingTaskId(task.id)
        setEditTitle(task.video_title || task.video_url)
    }

    const cancelEditing = (e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingTaskId(null)
        setEditTitle("")
    }

    const saveTitle = async (e: React.MouseEvent, taskId: string) => {
        e.stopPropagation()
        if (!editTitle.trim()) return

        try {
            const token = await getToken()
            if (!token) throw new Error("No token")

            await ApiClient.updateTaskTitle(taskId, editTitle, token)

            setTasks(tasks.map(t =>
                t.id === taskId ? { ...t, video_title: editTitle } : t
            ))
            setEditingTaskId(null)
        } catch (error) {
            console.error('Error updating task:', error)
            alert(t("tasks.updateError"))
        }
    }

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
            {showHeader ? (
                <CardHeader className="px-0 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2">
                        {t("tasks.recentTasks")}
                        <Badge variant="secondary" className="ml-2 bg-white/10 text-xs font-normal">
                            {tasks.length}
                        </Badge>
                    </CardTitle>
                </CardHeader>
            ) : null}
            <CardContent className="px-0 space-y-4">
                {tasks.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => router.push(`/tasks/${task.id}`)}
                        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-white/5 bg-card hover:bg-card/80 hover:border-white/10 transition-all cursor-pointer group"
                    >
                        {/* Thumbnail Placeholder */}
                        <div className="h-14 w-24 sm:h-16 sm:w-28 bg-black/40 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-white transition-colors overflow-hidden relative">
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
                            {editingTaskId === task.id ? (
                                <div className="flex items-center gap-2 pr-2">
                                    <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-8 text-sm"
                                        autoFocus
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                        onClick={(e) => saveTitle(e, task.id)}
                                    >
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-white"
                                        onClick={cancelEditing}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                            {task.video_title || task.video_url}
                                        </h4>
                                        {task.id !== DEMO_TASK_ID && (
                                            <div className="hidden group-hover:flex items-center opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                    onClick={(e) => startEditing(e, task)}
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                </>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                {task.id === DEMO_TASK_ID && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 font-normal border-blue-500/30 text-blue-400 bg-blue-500/10">
                                        Demo
                                    </Badge>
                                )}
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 font-normal border-white/10 bg-white/5">
                                    {getPlatformFromUrl(task.video_url)}
                                </Badge>
                                <span className="w-px h-3 bg-white/10 mx-1" />
                                <Clock className="h-3 w-3" />
                                {new Date(task.created_at).toLocaleString(LOCALE_DATE_TAG[locale], {
                                    year: 'numeric',
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </div>
                        </div>

                        <div>
                            {task.status === "processing" && (
                                <Badge variant="processing" className="gap-1 bg-blue-500/15 text-blue-500 hover:bg-blue-500/25">
                                    <span className="animate-pulse">●</span> <span className="hidden sm:inline">{task.progress}%</span>
                                </Badge>
                            )}
                            {task.status === "completed" && (
                                <Badge variant="success" className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25">
                                    <CheckCircle2 className="h-3 w-3" /> <span className="hidden sm:inline">{t("tasks.completed")}</span>
                                </Badge>
                            )}
                            {task.status === "error" && (
                                <Badge variant="destructive" className="gap-1">
                                    <AlertCircle className="h-3 w-3" /> <span className="hidden sm:inline">{t("tasks.error")}</span>
                                </Badge>
                            )}
                            {task.status === "pending" && (
                                <Badge variant="secondary" className="gap-1">
                                    <span className="hidden sm:inline">{t("tasks.waiting")}</span>
                                </Badge>
                            )}

                            {task.id !== DEMO_TASK_ID && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 ml-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200"
                                    onClick={(e) => handleDeleteClick(e, task.id)}
                                    disabled={isDeleting === task.id}
                                >
                                    {isDeleting === task.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>

            <ConfirmationModal
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation({ isOpen: false, taskId: null })}
                onConfirm={confirmDelete}
                title={t("tasks.deleteTaskTitle") || "Delete Task"}
                description={t("tasks.confirmDelete")}
                confirmText={t("tasks.confirm") || "Yes"}
                cancelText={t("tasks.cancel") || "Cancel"}
                isLoading={!!isDeleting}
            />
        </Card >
    )
}
