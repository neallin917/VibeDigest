'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Search, Clock, CheckCircle, AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns'
import { useI18n } from '@/components/i18n/I18nProvider'

interface Task {
  id: string
  video_url: string
  video_title?: string
  thumbnail_url?: string
  status: string
  created_at: string
}

interface GroupedTasks {
  label: string
  tasks: Task[]
}

// Group tasks by time period
function groupTasksByDate(tasks: Task[]): GroupedTasks[] {
  const groups: Record<string, Task[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: []
  }

  tasks.forEach(task => {
    const date = new Date(task.created_at)
    if (isToday(date)) {
      groups.today.push(task)
    } else if (isYesterday(date)) {
      groups.yesterday.push(task)
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(task)
    } else if (isThisMonth(date)) {
      groups.thisMonth.push(task)
    } else {
      groups.older.push(task)
    }
  })

  const result: GroupedTasks[] = []
  if (groups.today.length > 0) result.push({ label: 'Today', tasks: groups.today })
  if (groups.yesterday.length > 0) result.push({ label: 'Yesterday', tasks: groups.yesterday })
  if (groups.thisWeek.length > 0) result.push({ label: 'This Week', tasks: groups.thisWeek })
  if (groups.thisMonth.length > 0) result.push({ label: 'This Month', tasks: groups.thisMonth })
  if (groups.older.length > 0) result.push({ label: 'Older', tasks: groups.older })

  return result
}

interface LibrarySidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectTask: (taskId: string) => void
}

export function LibrarySidebar({ 
  isOpen, 
  onClose, 
  onSelectTask 
}: LibrarySidebarProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const { t } = useI18n()

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
      .limit(50)

    if (searchQuery) {
      query = query.ilike('video_title', `%${searchQuery}%`)
    }

    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [supabase, searchQuery])

  useEffect(() => {
    if (isOpen) fetchTasks()
  }, [isOpen, fetchTasks])

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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className={cn(
        "w-[320px] p-0 flex flex-col border-r shadow-2xl backdrop-blur-xl transition-all",
        "bg-white/80 border-white/40", // Light
        "dark:bg-black/80 dark:border-white/10" // Dark
      )}>
        <SheetHeader className="p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <SheetTitle className="text-slate-800 dark:text-white">
            {t('chat.library') || 'Library'}
          </SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('history.searchPlaceholder') || 'Search history...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 border-none focus-visible:ring-1 transition-all rounded-xl",
                "bg-black/5 placeholder:text-slate-400 focus-visible:bg-white", // Light
                "dark:bg-white/5 dark:placeholder:text-slate-500 dark:focus-visible:bg-white/10" // Dark
              )}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-sm">
              {searchQuery ? 'No results' : 'No history yet'}
            </div>
          ) : (
            groupTasksByDate(tasks).map(group => (
              <div key={group.label} className="mb-4">
                {/* Group Header */}
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {group.label}
                </div>
                {/* Group Tasks */}
                <div className="space-y-1">
                  {group.tasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onSelect={() => { onSelectTask(task.id); onClose() }}
                      onDelete={(e) => handleDelete(e, task.id)}
                      isDeleting={deletingId === task.id}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Task Item Component
interface TaskItemProps {
  task: Task
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  isDeleting: boolean
}

function TaskItem({ task, onSelect, onDelete, isDeleting }: TaskItemProps) {
  return (
    <div
      className={cn(
        "group w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border border-transparent relative",
        "hover:bg-white/60 hover:shadow-sm hover:border-white/50", // Light Hover
        "dark:hover:bg-white/5 dark:hover:border-white/5" // Dark Hover
      )}
    >
      {/* Clickable area */}
      <button
        onClick={onSelect}
        className="absolute inset-0 z-0"
        aria-label={task.video_title || 'Select task'}
      />

      {/* Thumbnail */}
      <div className="w-12 h-12 shrink-0 bg-slate-200 dark:bg-white/5 rounded-lg overflow-hidden relative border border-black/5 dark:border-white/10 z-10 pointer-events-none">
        {task.thumbnail_url ? (
          <img src={task.thumbnail_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Clock className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 z-10 pointer-events-none">
        <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate leading-tight mb-1">
          {task.video_title || task.video_url}
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <StatusIcon status={task.status} />
          <span>
            {task.created_at ? formatDistanceToNow(new Date(task.created_at), { addSuffix: true }) : ''}
          </span>
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={onDelete}
        className={cn(
          "z-20 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0",
          "hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500",
          isDeleting && "opacity-100"
        )}
        aria-label="Delete"
      >
        {isDeleting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Trash2 className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'processing': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />
    default: return <Clock className="w-3.5 h-3.5 text-slate-400" />
  }
}
