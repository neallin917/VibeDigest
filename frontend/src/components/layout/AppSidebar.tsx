"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Library,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Clock,
  Menu,
  Sparkles,
  MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useAppSidebar } from "./AppSidebarContext"
import { useI18n } from "@/components/i18n/I18nProvider"
import { createClient } from "@/lib/supabase"
import { formatDistanceToNow } from "date-fns"


// Types
interface Task {
  id: string
  video_url: string
  video_title?: string
  thumbnail_url?: string
  status: string
  created_at: string
}

interface Thread {
  id: string
  title: string
  updated_at: string
}

interface AppSidebarProps {
  onNewChat?: () => void
  onSelectTask?: (taskId: string) => void
  className?: string
  threads?: Thread[]
  activeThreadId?: string | null
  onSelectThread?: (threadId: string) => void
}

export function AppSidebar({ 
  onNewChat, 
  onSelectTask, 
  className,
  threads = [],
  activeThreadId,
  onSelectThread
}: AppSidebarProps) {
  const { isCollapsed, setCollapsed, toggleSidebar } = useAppSidebar()
  const router = useRouter()
  const { t, locale } = useI18n()

  // States
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isRecentsOpen, setIsRecentsOpen] = useState(true)
  const [isChatsOpen, setIsChatsOpen] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let query = supabase
      .from('tasks')
      .select('id, video_url, video_title, thumbnail_url, status, created_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(30)

    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [supabase])

  // Fetch when expanded
  useEffect(() => {
    if (!isCollapsed) {
      fetchTasks()
    }
  }, [isCollapsed, fetchTasks])

  // Handle task selection
  const handleTaskSelect = (taskId: string) => {
    if (onSelectTask) {
      onSelectTask(taskId)
    } else {
      router.push(`/${locale}/chat?task=${taskId}`)
    }
  }

  // Handle delete
  const handleDelete = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    setDeletingId(taskId)

    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true })
      .eq('id', taskId)

    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }
    setDeletingId(null)
  }

  // Handle new chat
  const handleNewChat = () => {
    if (onNewChat) {
      onNewChat()
    } else {
      router.push(`/${locale}/chat`)
    }
  }

  // Handle library click
  const handleLibraryClick = () => {
    // For now, just toggle recents open
    setIsRecentsOpen(true)
  }

  return (
    <aside
      className={cn(
        "h-screen flex-none flex flex-col py-4 hidden md:flex transition-all duration-300 ease-in-out",
        "border-r backdrop-blur-xl",
        "bg-white/70 border-slate-200/60",
        "dark:bg-black/40 dark:border-white/10",
        isCollapsed ? "w-[72px] px-3" : "w-[280px] px-4",
        className
      )}
    >
      {/* Hamburger Button - Always at top-left */}
      <div className={cn(
        "flex items-center mb-4 gap-3",
        isCollapsed ? "justify-center" : "justify-start px-2"
      )}>
        <button
          onClick={toggleSidebar}
          className={cn(
            "p-2.5 rounded-xl transition-all",
            "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
            "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
          )}
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo - Only visible when expanded or we can show icon when collapsed */}
        {!isCollapsed && (
             <div className="flex items-center gap-2">
                 <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 flex items-center justify-center shadow-sm">
                    <Sparkles className="w-4 h-4 text-white" />
                 </div>
                 <span className="font-bold text-slate-800 dark:text-white tracking-tight">VibeDigest</span>
             </div>
        )}
      </div>

      {isCollapsed ? (
        // ========== COLLAPSED VIEW ==========
        <CollapsedView
          onNewChat={handleNewChat}
          onLibraryClick={() => setCollapsed(false)}
          t={t}
        />
      ) : (
        // ========== EXPANDED VIEW ==========
        <>
          {/* New Task Button */}
          <button
            onClick={handleNewChat}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1 mx-1",
              "text-slate-600 hover:bg-slate-100",
              "dark:text-slate-300 dark:hover:bg-white/5"
            )}
          >
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">{t("chat.newChat") || "New task"}</span>
          </button>

          {/* Library Button */}
          <button
            onClick={handleLibraryClick}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-3 mx-1",
              "text-slate-600 hover:bg-slate-100",
              "dark:text-slate-300 dark:hover:bg-white/5"
            )}
          >
            <Library className="w-5 h-5" />
            <span className="text-sm font-medium">{t("chat.library") || "Library"}</span>
          </button>

          {/* Divider */}
          <div className="h-px mx-3 mb-3 bg-slate-200/60 dark:bg-white/10" />

          {/* Chats Section */}
          <div className="flex-none flex flex-col mb-2">
            <button
              onClick={() => setIsChatsOpen(!isChatsOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all rounded-xl mx-1",
                "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                "dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5"
              )}
            >
              {isChatsOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span>Chats</span>
            </button>
            
            {isChatsOpen && (
              <div className="overflow-y-auto max-h-[30vh] custom-scrollbar mt-1 px-1 space-y-0.5">
                {threads.length === 0 ? (
                   <div className="text-center py-4 px-4">
                     <p className="text-xs text-slate-400">No chats yet</p>
                   </div>
                ) : (
                  threads.map(thread => (
                    <button
                      key={thread.id}
                      onClick={() => onSelectThread?.(thread.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 cursor-pointer group",
                        "hover:bg-slate-100 dark:hover:bg-white/5",
                        activeThreadId === thread.id && "bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      )}
                    >
                      <MessageSquare className={cn(
                        "w-4 h-4 shrink-0",
                        activeThreadId === thread.id ? "text-emerald-500" : "text-slate-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">
                            {thread.title || 'New Chat'}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Recents Section */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Recents Header */}
            <button
              onClick={() => setIsRecentsOpen(!isRecentsOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all rounded-xl mx-1",
                "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                "dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/5"
              )}
            >
              {isRecentsOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span>Recents</span>
            </button>

            {/* Recents List */}
            {isRecentsOpen && (
              <div className="flex-1 overflow-y-auto custom-scrollbar mt-1">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-6 px-4">
                    <p className="text-sm text-slate-400">
                      No recent tasks
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5 px-1">
                    {tasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onSelect={() => handleTaskSelect(task.id)}
                        onDelete={(e) => handleDelete(e, task.id)}
                        isDeleting={deletingId === task.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

// ========== COLLAPSED VIEW COMPONENT ==========
interface CollapsedViewProps {
  onNewChat: () => void
  onLibraryClick: () => void
  t: (key: string) => string
}

function CollapsedView({ onNewChat, onLibraryClick, t }: CollapsedViewProps) {
  return (
    <>
      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1.5 pt-2">
        {/* New Task */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={onNewChat}
              className={cn(
                "p-3 rounded-xl flex items-center justify-center transition-all",
                "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
              )}
            >
              <Plus className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {t("chat.newChat") || "New task"}
          </TooltipContent>
        </Tooltip>

        {/* Library */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              onClick={onLibraryClick}
              className={cn(
                "p-3 rounded-xl flex items-center justify-center transition-all",
                "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                "dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10"
              )}
            >
              <Library className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={12}>
            {t("chat.library") || "Library"}
          </TooltipContent>
        </Tooltip>
      </nav>
    </>
  )
}

// ========== TASK ITEM COMPONENT ==========
interface TaskItemProps {
  task: Task
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  isDeleting: boolean
}

function TaskItem({ task, onSelect, onDelete, isDeleting }: TaskItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group w-full text-left px-3 py-2 rounded-xl transition-all flex items-center gap-3 cursor-pointer relative",
        "hover:bg-slate-100 dark:hover:bg-white/5"
      )}
    >
      {/* Status Icon */}
      <StatusIcon status={task.status} />

      {/* Title */}
      <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 truncate">
        {task.video_title || 'Untitled'}
      </span>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className={cn(
          "p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0",
          "hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500",
          isDeleting && "opacity-100"
        )}
        aria-label="Delete"
      >
        {isDeleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  )
}

// Status Icon
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
    default:
      return <Clock className="w-4 h-4 text-slate-400 shrink-0" />
  }
}
